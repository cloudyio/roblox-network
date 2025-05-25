import { NextResponse } from 'next/server';
import { getSession } from '@/lib/neo4j';
import { User, NetworkData, NetworkNode, NetworkLink } from '@/types/user';

export async function POST(
  request: Request,
  { params }: { params: { username: string; friendId: string } }
) {
  const session = getSession();
  
  try {
    const { username, friendId } = await params;
    const friendIdNum = parseInt(friendId);
    
    if (isNaN(friendIdNum)) {
      return NextResponse.json({ error: 'Invalid friend ID' }, { status: 400 });
    }

    // Get the final desired set of expanded nodes from the request body
    const body = await request.json();
    const finalDesiredExpandedNodeIds = new Set(body.finalDesiredExpandedNodeIds || []);
    
    // Find the main user
    const mainUserResult = await session.run(
      'MATCH (u:User) WHERE toLower(u.username) = toLower($username) RETURN u',
      { username }
    );
    
    if (mainUserResult.records.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const mainUserRecord = mainUserResult.records[0];
    const mainUserIdValue = mainUserRecord.get('u').properties._id;
    const mainUser = {
      id: typeof mainUserIdValue.toNumber === 'function' ? mainUserIdValue.toNumber() : mainUserIdValue,
      username: mainUserRecord.get('u').properties.username
    };
    
    // Collect all node IDs that should be in the graph
    const nodesToIncludeIds = new Set<number>();
    nodesToIncludeIds.add(mainUser.id); // Always include the main user
    
    // Get main user's direct friends
    const mainUserFriendsResult = await session.run(
      `MATCH (u:User)-[:FRIENDS_WITH]-(f:User) 
       WHERE u._id = $userId 
       RETURN f._id as friendId`,
      { userId: mainUser.id }
    );
    
    mainUserFriendsResult.records.forEach(record => {
      const friendIdValue = record.get('friendId');
      nodesToIncludeIds.add(typeof friendIdValue.toNumber === 'function' ? friendIdValue.toNumber() : friendIdValue);
    });
    
    // Add the expanded nodes themselves
    finalDesiredExpandedNodeIds.forEach(id => nodesToIncludeIds.add(id as number));
    
    // For each expanded friend, get their friends
    if (finalDesiredExpandedNodeIds.size > 0) {
      const expandedFriendsResult = await session.run(
        `MATCH (u:User)-[:FRIENDS_WITH]-(f:User) 
         WHERE u._id IN $expandedIds 
         RETURN f._id as friendId`,
        { expandedIds: Array.from(finalDesiredExpandedNodeIds) }
      );
      
      expandedFriendsResult.records.forEach(record => {
        const friendIdValue = record.get('friendId');
        nodesToIncludeIds.add(typeof friendIdValue.toNumber === 'function' ? friendIdValue.toNumber() : friendIdValue);
      });
    }
    
    // Fetch all users that should be included in the graph
    const allUsersResult = await session.run(
      'MATCH (u:User) WHERE u._id IN $userIds RETURN u',
      { userIds: Array.from(nodesToIncludeIds) }
    );
    
    const allUsers = allUsersResult.records.map(record => {
      const userIdValue = record.get('u').properties._id;
      return {
        id: typeof userIdValue.toNumber === 'function' ? userIdValue.toNumber() : userIdValue,
        username: record.get('u').properties.username
      };
    });
    
    // Get all friendships between the included users
    const linksResult = await session.run(
      `MATCH (u1:User)-[:FRIENDS_WITH]-(u2:User) 
       WHERE u1._id IN $userIds AND u2._id IN $userIds AND u1._id < u2._id
       RETURN u1._id as source, u2._id as target`,
      { userIds: Array.from(nodesToIncludeIds) }
    );
    
    const links: NetworkLink[] = linksResult.records.map(record => {
      const sourceValue = record.get('source');
      const targetValue = record.get('target');
      
      return {
        source: typeof sourceValue.toNumber === 'function' ? sourceValue.toNumber() : sourceValue,
        target: typeof targetValue.toNumber === 'function' ? targetValue.toNumber() : targetValue,
        color: '#10b981',
        width: 2
      };
    });
    
    // Filter users to only include those with connections (except main user)
    const connectedNodeIds = new Set<number>();
    links.forEach(link => {
      connectedNodeIds.add(link.source);
      connectedNodeIds.add(link.target);
    });
    
    // Always include main user, filter others by connections
    const connectedUsers = allUsers.filter(user => 
      user.id === mainUser.id || connectedNodeIds.has(user.id)
    );

    // Deduplicate nodes by ID
    const uniqueUsersMap = new Map<number, {id: number, username: string}>();
    connectedUsers.forEach(user => {
      uniqueUsersMap.set(user.id, user);
    });
    const uniqueUsers = Array.from(uniqueUsersMap.values());

    // Deduplicate links (source < target)
    const uniqueLinkKeys = new Set<string>();
    const uniqueLinks: NetworkLink[] = [];
    links.forEach(link => {
      const key = `${Math.min(link.source, link.target)}-${Math.max(link.source, link.target)}`;
      if (!uniqueLinkKeys.has(key)) {
        uniqueLinkKeys.add(key);
        // Assign color: green if main user involved, purple otherwise
        const isMainUserLink = link.source === mainUser.id || link.target === mainUser.id;
        uniqueLinks.push({
          ...link,
          color: isMainUserLink ? '#10b981' : '#8b5cf6',
        });
      }
    });

    // Recalculate mutual friends (those who are in a link not involving the main user)
    const mutualFriendIds = new Set<number>();
    uniqueLinks.forEach(link => {
      if (link.source !== mainUser.id && link.target !== mainUser.id) {
        mutualFriendIds.add(link.source);
        mutualFriendIds.add(link.target);
      }
    });

    // Create nodes only for connected users, with correct color
    const nodes: NetworkNode[] = uniqueUsers.map(user => {
      const isMainUser = user.id === mainUser.id;
      const isMutual = mutualFriendIds.has(user.id);
      const isExpanded = finalDesiredExpandedNodeIds.has(user.id);
      return {
        id: user.id,
        name: user.username,
        val: isMainUser ? 8 : 4,
        color: isMainUser ? '#ef4444' : (isMutual ? '#8b5cf6' : (isExpanded ? '#10b981' : '#3b82f6'))
      };
    });

    const networkData: NetworkData = { nodes, links: uniqueLinks };
    
    return NextResponse.json({
      networkData,
      mainUser: {
        id: mainUser.id,
        username: mainUser.username,
        friendCount: mainUserFriendsResult.records.length
      }
    });
  } catch (error) {
    console.error('Error collapsing network:', error);
    return NextResponse.json({ error: 'Failed to collapse network' }, { status: 500 });
  } finally {
    await session.close();
  }
} 