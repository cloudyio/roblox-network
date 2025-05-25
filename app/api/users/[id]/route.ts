import { NextResponse } from 'next/server';
import { getSession } from '@/lib/neo4j';
import { User } from '@/types/user';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession();
  const { id } = await params;
  
  try {
    console.log('Fetching user with ID:', id);
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      console.log('Invalid user ID provided:', id);
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Get user and their friends
    const userResult = await session.run(
      'MATCH (u:User {_id: $userId}) RETURN u',
      { userId }
    );
    
    if (userResult.records.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userRecord = userResult.records[0];
    const user: User = {
      id: userRecord.get('u').properties._id.toNumber(),
      username: userRecord.get('u').properties.username,
      friends: [], // Will be populated below
      createdAt: userRecord.get('u').properties.createdAt
    };

    // Get user's friends
    const friendsResult = await session.run(
      `MATCH (u:User {_id: $userId})-[:FRIENDS_WITH]-(f:User) 
       RETURN f ORDER BY f.username`,
      { userId }
    );
    
    const friends = friendsResult.records.map(record => ({
      id: record.get('f').properties._id.toNumber(),
      username: record.get('f').properties.username,
      friends: [], // Not needed for this response
      createdAt: record.get('f').properties.createdAt
    }));
    
    // Update user's friends array with friend IDs
    user.friends = friends.map(friend => friend.id);

    console.log(`Successfully fetched user ${user.username} (ID: ${user.id}) with ${friends.length} friends`);
    return NextResponse.json({ user, friends });
  } catch (error) {
    console.error('Error fetching user:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: id
    });
    return NextResponse.json({ 
      error: 'Failed to fetch user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await session.close();
  }
} 