import { NextResponse } from 'next/server';
import { getSession } from '@/lib/neo4j';


export async function POST(request: Request) {
  const session = getSession();
  
  try {
    const body = await request.json();
    const { fromUser, toUser } = body;

    if (!fromUser || !toUser) {
      return NextResponse.json({ error: 'Both usernames are required' }, { status: 400 });
    }

    // Find both users
    const usersResult = await session.run(
      `MATCH (start:User), (end:User) 
       WHERE toLower(start.username) = toLower($fromUser) 
       AND toLower(end.username) = toLower($toUser)
       RETURN start, end`,
      { fromUser, toUser }
    );

    if (usersResult.records.length === 0) {
      return NextResponse.json({ 
        error: `One or both users not found: ${fromUser}, ${toUser}` 
      }, { status: 404 });
    }

    const record = usersResult.records[0];
    const startUser = {
      id: record.get('start').properties._id.toNumber(),
      username: record.get('start').properties.username
    };
    const endUser = {
      id: record.get('end').properties._id.toNumber(),
      username: record.get('end').properties.username
    };

    if (startUser.id === endUser.id) {
      // Fetch direct friends of startUser - handle bidirectional relationships properly
      const friendsResult = await session.run(
        `MATCH (user:User {_id: $userId})
         MATCH (friend:User)
         WHERE (user)-[:FRIENDS_WITH]-(friend) AND user._id <> friend._id
         RETURN DISTINCT friend._id as friendId, friend.username as friendUsername`,
        { userId: startUser.id }
      );

      const friendNodes = friendsResult.records.map(record => {
        return {
          id: record.get('friendId').toNumber(),
          name: record.get('friendUsername'),
          val: 4, // Context node value
          color: '#3b82f6' // Blue for context nodes (friends)
        };
      });

      // Remove any potential duplicates by using a Map
      const uniqueFriendNodes = Array.from(
        new Map(friendNodes.map(node => [node.id, node])).values()
      );

      const friendLinks = uniqueFriendNodes.map(friend => ({
        source: startUser.id,
        target: friend.id,
        color: '#10b981', // Green for context links
        width: 2
      }));

      const allNodes = [
        {
          id: startUser.id,
          name: startUser.username,
          val: 8,
          color: '#ff6b6b' // Bright red for the user themselves
        },
        ...uniqueFriendNodes
      ];

      return NextResponse.json({ 
        path: [startUser.id],
        pathNodes: allNodes,
        pathLinks: friendLinks,
        pathLength: 1, // Path is just the single user node
        degreesOfSeparation: 0
      });
    }

    // Use Neo4j's built-in shortest path algorithm
    const pathResult = await session.run(
      `MATCH (start:User {_id: $startId}), (end:User {_id: $endId})
       MATCH path = shortestPath((start)-[:FRIENDS_WITH*]-(end))
       RETURN [node in nodes(path) | node._id] as pathIds,
              length(path) as pathLength`,
      { startId: startUser.id, endId: endUser.id }
    );

    if (pathResult.records.length === 0) {
      return NextResponse.json({ 
        path: [],
        pathNodes: [],
        pathLinks: [],
        pathLength: 0,
        degreesOfSeparation: -1
      });
    }

    const pathRecord = pathResult.records[0];
    const pathIds = pathRecord.get('pathIds').map((id: unknown) => {
      const idObj = id as { toNumber?: () => number };
      return typeof idObj.toNumber === 'function' ? idObj.toNumber() : id;
    });
    const pathLength = pathRecord.get('pathLength').toNumber();

    // Get full user data for all nodes in the path AND their direct friends for context
    const pathUserIds = new Set(pathIds);
    
    // Get path users data
    const pathUsersResult = await session.run(
      'MATCH (u:User) WHERE u._id IN $pathIds RETURN u',
      { pathIds }
    );

    const pathUsersData = pathUsersResult.records.map(record => {
      const idValue = record.get('u').properties._id;
      return {
        id: typeof idValue.toNumber === 'function' ? idValue.toNumber() : idValue,
        username: record.get('u').properties.username
      };
    });

    // Collect IDs of direct friends of the primary user only (for context)
    const contextFriendsResult = await session.run(
      `MATCH (primary:User {_id: $primaryUserId}), (friend:User) 
       WHERE (primary)-[:FRIENDS_WITH]-(friend) 
       AND primary._id <> friend._id
       RETURN DISTINCT friend._id as friendId`,
      { primaryUserId: startUser.id }
    );

    const friendsOfPrimaryUserIds = new Set<number>();
    contextFriendsResult.records.forEach(record => {
      friendsOfPrimaryUserIds.add(record.get('friendId').toNumber());
    });

    // Get context users data (friends of primary user who aren't in the path)
    const contextUserIds = Array.from(friendsOfPrimaryUserIds).filter(id => !pathUserIds.has(id));
    let contextUsersData: {id: number, username: string}[] = [];
    
    if (contextUserIds.length > 0) {
      const contextUsersResult = await session.run(
        'MATCH (u:User) WHERE u._id IN $contextIds RETURN u',
        { contextIds: contextUserIds }
      );
      contextUsersData = contextUsersResult.records.map(record => {
        const idValue = record.get('u').properties._id;
        return {
          id: typeof idValue.toNumber === 'function' ? idValue.toNumber() : idValue,
          username: record.get('u').properties.username
        };
      });
      // Remove any potential duplicates from context users
      contextUsersData = Array.from(
        new Map(contextUsersData.map(user => [user.id, user])).values()
      );
    }

    // Create nodes for visualization
    const finalNodesMap = new Map<number, {id: number, name: string, val: number, color: string}>();

    // Add path users (highlighted in red)
    pathUsersData.forEach(user => {
      finalNodesMap.set(user.id, {
        id: user.id,
        name: user.username,
        val: 8,
        color: '#ff6b6b' // Bright red for path nodes
      });
    });

    // Add context users (friends of path users, in blue)
    // Ensure they are not already added as path nodes and handle potential duplicates from contextUsersData itself.
    contextUsersData.forEach(user => {
      if (!finalNodesMap.has(user.id)) {
        finalNodesMap.set(user.id, {
          id: user.id,
          name: user.username,
          val: 4,
          color: '#3b82f6' // Blue for context nodes
        });
      }
    });

    const pathNodes = Array.from(finalNodesMap.values());

    // Get relationships for:
    // 1. Links between path nodes (the actual shortest path)
    // 2. Links between primary user and their direct friends
    const pathLinksResult = await session.run(
      `MATCH (u1:User), (u2:User) 
       WHERE u1._id IN $pathIds AND u2._id IN $pathIds 
       AND u1._id < u2._id
       AND (u1)-[:FRIENDS_WITH]-(u2)
       RETURN u1._id as source, u2._id as target, 'path' as linkType`,
      { pathIds }
    );

    const primaryUserFriendLinksResult = await session.run(
      `MATCH (primary:User {_id: $primaryUserId}), (friend:User)
       WHERE (primary)-[:FRIENDS_WITH]-(friend) 
       AND friend._id IN $contextIds
       RETURN primary._id as source, friend._id as target, 'context' as linkType`,
      { primaryUserId: startUser.id, contextIds: contextUserIds }
    );

    const allLinksResults = [...pathLinksResult.records, ...primaryUserFriendLinksResult.records];

    const pathLinks = allLinksResults.map(record => {
      const sourceValue = record.get('source');
      const targetValue = record.get('target');
      const source = typeof sourceValue.toNumber === 'function' ? sourceValue.toNumber() : sourceValue;
      const target = typeof targetValue.toNumber === 'function' ? targetValue.toNumber() : targetValue;
      const linkType = record.get('linkType');
      
      // Check if this link is part of the shortest path
      const isPathLink = linkType === 'path' && pathIds.includes(source) && pathIds.includes(target) &&
                        Math.abs(pathIds.indexOf(source) - pathIds.indexOf(target)) === 1;
      
      return {
        source,
        target,
        color: isPathLink ? '#ff6b6b' : '#10b981', // Red for path links, green for primary user's friends
        width: isPathLink ? 4 : 2
      };
    });

    return NextResponse.json({
      path: pathIds,
      pathNodes,
      pathLinks,
      pathLength: pathLength + 1, // +1 because length is number of edges, we want number of nodes
      degreesOfSeparation: pathLength
    });

  } catch (error) {
    console.error('Error finding shortest path:', error);
    return NextResponse.json({ error: 'Failed to find shortest path' }, { status: 500 });
  } finally {
    await session.close();
  }
} 