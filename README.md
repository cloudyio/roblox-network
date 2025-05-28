# Roblox Friends Network Visualization

A Next.js application for visualizing Roblox user friendship networks using Neo4j graph database.
Inspiration this website [here](https://areyoufriendswithdavid.xyz/)

Demo at [network.cloudyio.me]

## Features

- **Interactive Network Visualization**: View friendship networks with zoom, pan, and drag functionality
- **Network Expansion**: Click on friends to expand their networks and explore connections
- **Shortest Path Finding**: Find the shortest path between any two users in the network
- **Real-time Graph Physics**: Smooth animations and force-directed layout
- **Neo4j Integration**: Efficient graph queries using Cypher

## Prerequisites

- Node.js 18+ installed
- Neo4j database (local installation or Neo4j Aura cloud)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Neo4j Database

Follow the detailed setup guide in [NEO4J_SETUP.md](./NEO4J_SETUP.md) to:
- Install and configure Neo4j
- Set up your database connection

### 3. Environment Configuration

Create a `.env.local` file in the project root:

```env
# Neo4j connection settings
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# For Neo4j Aura (cloud):
# NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=your-generated-password
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Usage

1. **Enter a Username**: Type a Roblox username in the search box
2. **Explore the Network**: 
   - Click and drag nodes to reposition them
   - Use mouse wheel to zoom in/out
   - Click and drag empty space to pan around
3. **Expand Networks**: Click on friend nodes to expand their networks
4. **Find Shortest Paths**: Use the shortest path feature to find connections between users
5. **Pin Nodes**: Drag nodes to pin them in place, double-click to unpin

## API Endpoints

- `GET /api/users` - Get all users
- `GET /api/users/[id]` - Get specific user details
- `GET /api/network/[username]` - Get user's friendship network
- `POST /api/network/[username]/expand/[friendId]` - Expand friend's network
- `POST /api/network/[username]/collapse/[friendId]` - Collapse friend's network
- `POST /api/shortest-path` - Find shortest path between two users

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database**: Neo4j with Cypher queries
- **Visualization**: Custom HTML5 Canvas with physics simulation
- **UI Components**: Radix UI, Lucide React icons

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.
