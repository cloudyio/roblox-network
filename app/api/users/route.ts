import { NextResponse } from 'next/server';
import { getSession } from '@/lib/neo4j';


export async function GET() {
  const session = getSession();
  
  try {
    const result = await session.run(
      'MATCH (u:User) RETURN u ORDER BY u.username'
    );
    
    const users = result.records.map(record => ({
      id: record.get('u').properties._id.toNumber(),
      username: record.get('u').properties.username,
      friends: [], // We'll populate this if needed
      createdAt: record.get('u').properties.createdAt
    }));
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  } finally {
    await session.close();
  }
} 