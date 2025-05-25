import { NextResponse } from 'next/server';
import { getSession } from '@/lib/neo4j';
import { NetworkData, NetworkNode, NetworkLink } from '@/types/user';

function getNodeColor(friendCount: number): string {
  if (friendCount >= 20) return '#ef4444'; // Red for highly connected
  if (friendCount >= 10) return '#f97316'; // Orange for well connected
  if (friendCount >= 5) return '#eab308';  // Yellow for moderately connected
  return '#3b82f6'; // Blue for less connected
}

export async function GET() {
  const session = getSession();
  
  try {
    // Get all users with their friend counts
    const usersResult = await session.run(
      `MATCH (u:User)
       OPTIONAL MATCH (u)-[:FRIENDS_WITH]-(f:User)
       RETURN u, count(f) as friendCount
       ORDER BY u.username`
    );
    
    const users = usersResult.records.map(record => {
      const idValue = record.get('u').properties._id;
      const friendCountValue = record.get('friendCount');
      
      return {
        id: typeof idValue.toNumber === 'function' ? idValue.toNumber() : idValue,
        username: record.get('u').properties.username,
        friendCount: typeof friendCountValue.toNumber === 'function' ? friendCountValue.toNumber() : friendCountValue
      };
    });
    
    // Create nodes
    const nodes: NetworkNode[] = users.map(user => ({
      id: user.id,
      name: user.username,
      val: user.friendCount + 1, // Node size based on friend count
      color: getNodeColor(user.friendCount)
    }));
    
    // Get all friendships
    const linksResult = await session.run(
      `MATCH (u1:User)-[:FRIENDS_WITH]-(u2:User) 
       WHERE u1._id < u2._id
       RETURN u1._id as source, u2._id as target`
    );
    
    const links: NetworkLink[] = linksResult.records.map(record => {
      const sourceValue = record.get('source');
      const targetValue = record.get('target');
      
      return {
        source: typeof sourceValue.toNumber === 'function' ? sourceValue.toNumber() : sourceValue,
        target: typeof targetValue.toNumber === 'function' ? targetValue.toNumber() : targetValue,
        color: '#10b981', // Green for all friendships (they're all mutual in Neo4j)
        width: 2
      };
    });
    
    const networkData: NetworkData = { nodes, links };
    return NextResponse.json(networkData);
  } catch (error) {
    console.error('Error generating network data:', error);
    return NextResponse.json({ error: 'Failed to generate network data' }, { status: 500 });
  } finally {
    await session.close();
  }
} 