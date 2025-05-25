# Neo4j Setup Guide

This guide will help you set up Neo4j for your Roblox Friends Network application.

## Prerequisites

- Node.js installed
- Either a local Neo4j installation or Neo4j Aura (cloud) account

## Option 1: Local Neo4j Installation

### 1. Install Neo4j Desktop

1. Download Neo4j Desktop from [https://neo4j.com/download/](https://neo4j.com/download/)
2. Install and create a new project
3. Create a new database with the following settings:
   - Name: `roblox-friends`
   - Password: Choose a secure password
   - Version: Latest stable (5.x recommended)

### 2. Start the Database

1. Click "Start" on your database
2. Note the connection details (usually `bolt://localhost:7687`)

## Option 2: Neo4j Aura (Cloud)

### 1. Create an Account

1. Go to [https://neo4j.com/cloud/aura/](https://neo4j.com/cloud/aura/)
2. Sign up for a free account
3. Create a new database instance

### 2. Get Connection Details

1. After creating the instance, download the connection file
2. Note your connection URI, username, and password

## Environment Configuration

### 1. Update Environment Variables

Create a `.env.local` file in your project root with:

```env
# Neo4j connection settings
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# For Neo4j Aura, use something like:
# NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=your-generated-password
```

### 2. Install Dependencies

The Neo4j driver should already be installed. If not:

```bash
npm install neo4j-driver
```

## Sample Data Setup

If you want to create sample data for testing, you can run these queries in Neo4j Browser:

```cypher
// Create sample users
CREATE (u1:User {id: 1, username: "john_doe", createdAt: datetime()})
CREATE (u2:User {id: 2, username: "jane_smith", createdAt: datetime()})
CREATE (u3:User {id: 3, username: "bob_wilson", createdAt: datetime()})

// Create friendships
CREATE (u1)-[:FRIENDS_WITH]->(u2)
CREATE (u2)-[:FRIENDS_WITH]->(u3)
CREATE (u1)-[:FRIENDS_WITH]->(u3)
```

## Database Schema

### Node Types

- **User**: Represents a Roblox user
  - `id`: Unique Roblox user ID (integer)
  - `username`: Roblox username (string)
  - `createdAt`: When the user was added to the database (datetime)

### Relationship Types

- **FRIENDS_WITH**: Represents a friendship between two users
  - Bidirectional relationship (if A is friends with B, then B is friends with A)

### Constraints and Indexes

The application automatically creates:

```cypher
// Unique constraint on user ID
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;

// Index on username for faster lookups
CREATE INDEX user_username_index IF NOT EXISTS FOR (u:User) ON (u.username);
```

## Verification

### 1. Test Connection

Start your Next.js application:

```bash
npm run dev
```

### 2. Check API Endpoints

Test the following endpoints:

- `GET /api/users` - Should return all users
- `GET /api/network/[username]` - Should return a user's network
- `POST /api/shortest-path` - Should find shortest paths between users

### 3. Neo4j Browser

You can also verify data directly in Neo4j Browser:

```cypher
// Count all users
MATCH (u:User) RETURN count(u) as userCount;

// Count all friendships
MATCH ()-[:FRIENDS_WITH]->() RETURN count(*) as friendshipCount;

// View sample data
MATCH (u:User)-[:FRIENDS_WITH]-(f:User) 
RETURN u.username, f.username 
LIMIT 10;
```

## Troubleshooting

### Connection Issues

1. **"Failed to connect to server"**
   - Check if Neo4j is running
   - Verify the URI in your `.env.local`
   - For Aura, ensure you're using the correct protocol (`neo4j+s://`)

2. **Authentication failed**
   - Double-check username and password
   - For new installations, default username is `neo4j`

3. **Database not found**
   - Ensure the database is started in Neo4j Desktop
   - For Aura, the database should be automatically available

### Performance

1. **Slow queries**
   - Ensure indexes are created (they should be automatic)
   - For large datasets, consider additional indexes:
   ```cypher
   CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id);
   ```

2. **Memory issues**
   - Increase Neo4j memory settings in Neo4j Desktop
   - For Aura, consider upgrading your instance size

## Advanced Configuration

### Custom Cypher Queries

You can run custom queries in the Neo4j Browser or through the driver:

```cypher
// Find users with the most friends
MATCH (u:User)-[:FRIENDS_WITH]-(f:User)
RETURN u.username, count(f) as friendCount
ORDER BY friendCount DESC
LIMIT 10;

// Find mutual friends between two users
MATCH (u1:User {username: "john_doe"})-[:FRIENDS_WITH]-(mutual)-[:FRIENDS_WITH]-(u2:User {username: "jane_smith"})
WHERE u1 <> u2
RETURN mutual.username as mutualFriend;

// Find the shortest path between any two users
MATCH (start:User {username: "john_doe"}), (end:User {username: "bob_wilson"})
MATCH path = shortestPath((start)-[:FRIENDS_WITH*]-(end))
RETURN [node in nodes(path) | node.username] as path;
```

### Backup and Restore

For production use, set up regular backups:

1. **Neo4j Desktop**: Use the built-in backup feature
2. **Neo4j Aura**: Backups are handled automatically
3. **Self-hosted**: Use `neo4j-admin dump` and `neo4j-admin load`

## Next Steps

1. Test all functionality with your data
2. Set up monitoring for your Neo4j instance
3. Consider implementing additional features like:
   - Friend recommendations based on mutual connections
   - Community detection algorithms
   - Influence analysis using centrality measures

For more advanced Neo4j features, check out the [Neo4j Documentation](https://neo4j.com/docs/). 