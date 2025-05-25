import { NextResponse } from 'next/server';
import { getSession } from '@/lib/neo4j';
import { NetworkData, NetworkNode, NetworkLink } from '@/types/user';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const session = getSession();
  
  try {
    const { username } = await params;
    
    // Find the main user
    const mainUserResult = await session.run(
      'MATCH (u:User) WHERE toLower(u.username) = toLower($username) RETURN u',
      { username }
    );
    
    if (mainUserResult.records.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const mainUserRecord = mainUserResult.records[0];
    const mainUser = {
      id: mainUserRecord.get('u').properties._id.toNumber(),
      username: mainUserRecord.get('u').properties.username,
      friends: [], // Will be populated from relationships
      createdAt: mainUserRecord.get('u').properties.createdAt
    };
    
    // Get direct friends (1 degree of separation) - but we'll filter these later
    const friendsResult = await session.run(
      `MATCH (u:User)-[:FRIENDS_WITH]-(f:User) 
       WHERE u._id = $_id 
       RETURN f`,
      { _id: mainUser.id }
    );
    
    const allFriends = friendsResult.records.map(record => ({
      id: record.get('f').properties._id.toNumber(),
      username: record.get('f').properties.username,
      friends: [], // Not needed for this endpoint
      createdAt: record.get('f').properties.createdAt
    }));
    
    // Create links from main user to their friends
    const links: NetworkLink[] = [];
    
    console.log(`Main user ID: ${mainUser.id}, Username: ${mainUser.username}`);
    console.log(`Found ${allFriends.length} friends:`, allFriends.map(f => `${f.id}:${f.username}`));
    
    // First, let's verify we can find friendships involving the main user specifically
    const mainUserLinksTest = await session.run(
      `MATCH (u:User)-[:FRIENDS_WITH]-(f:User) 
       WHERE u._id = $mainUserId 
       RETURN f._id as friendId, f.username as friendUsername`,
      { mainUserId: mainUser.id }
    );
    
    console.log(`Direct friendship test found ${mainUserLinksTest.records.length} connections for main user`);
    mainUserLinksTest.records.forEach(record => {
      const friendIdValue = record.get('friendId');
      const friendId = typeof friendIdValue.toNumber === 'function' ? friendIdValue.toNumber() : friendIdValue;
      console.log(`  -> Friend: ${friendId}:${record.get('friendUsername')}`);
    });
    
    // Get all friendships between the included users (main user + their friends)
    const allUserIds = [mainUser.id, ...allFriends.map(f => f.id)];
    
    console.log(`Searching for links between users:`, allUserIds);
    
    const linksResult = await session.run(
      `MATCH (u1:User)-[:FRIENDS_WITH]-(u2:User) 
       WHERE u1._id IN $userIds AND u2._id IN $userIds AND u1._id < u2._id
       RETURN u1._id as source, u2._id as target`,
      { userIds: allUserIds }
    );
    
    console.log(`Found ${linksResult.records.length} friendship records`);
    
    // Create links from the friendship relationships
    linksResult.records.forEach(record => {
      const sourceValue = record.get('source');
      const targetValue = record.get('target');
      
      const sourceId = typeof sourceValue.toNumber === 'function' ? sourceValue.toNumber() : sourceValue;
      const targetId = typeof targetValue.toNumber === 'function' ? targetValue.toNumber() : targetValue;
      
      // Determine link color based on whether it involves the main user
      const isMainUserLink = sourceId === mainUser.id || targetId === mainUser.id;
      
      links.push({
        source: sourceId,
        target: targetId,
        color: isMainUserLink ? '#10b981' : '#8b5cf6', // Green for main user connections, purple for mutual friend connections
        width: 2
      });
    });
    
    // Get all node IDs that have at least one connection
    const connectedNodeIds = new Set<number>();
    links.forEach(link => {
      connectedNodeIds.add(link.source);
      connectedNodeIds.add(link.target);
    });
    // Filter friends to only include those with connections
    const connectedFriends = allFriends.filter(friend => connectedNodeIds.has(friend.id));

    // Deduplicate nodes by ID
    const uniqueUsersMap = new Map<number, {id: number, username: string, friends: number[], createdAt: unknown}>();
    uniqueUsersMap.set(mainUser.id, mainUser);
    connectedFriends.forEach(user => {
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
        uniqueLinks.push(link);
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
      return {
        id: user.id,
        name: user.username,
        val: isMainUser ? 8 : 4,
        color: isMainUser ? '#ef4444' : (isMutual ? '#8b5cf6' : '#3b82f6')
      };
    });

    const networkData: NetworkData = { nodes, links: uniqueLinks };
    
    return NextResponse.json({
      networkData,
      mainUser: {
        id: mainUser.id,
        username: mainUser.username,
        friendCount: allFriends.length
      }
    });
  } catch (error) {
    console.error('Error fetching network data:', error);
    return NextResponse.json({ error: 'Failed to fetch network data' }, { status: 500 });
  } finally {
    await session.close();
  }
}

 