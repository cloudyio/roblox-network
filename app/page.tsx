'use client';

import { useState } from 'react';
import { NetworkGraph } from '@/components/network-graph';
import { UsernameInput } from '@/components/username-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, NetworkNode, NetworkLink } from '@/types/user';

export default function Home() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFriends, setUserFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  
  // Shortest path state
  const [pathFromUser, setPathFromUser] = useState('');
  const [pathToUser, setPathToUser] = useState('');
  const [pathFinding, setPathFinding] = useState(false);
  const [shortestPath, setShortestPath] = useState<number[]>([]);
  const [pathNodes, setPathNodes] = useState<NetworkNode[]>([]);
  const [pathLinks, setPathLinks] = useState<NetworkLink[]>([]);
  const [pathError, setPathError] = useState<string | null>(null);

  const handleUsernameSubmit = async (username: string) => {
    setUsernameLoading(true);
    setCurrentUsername(username);
    // Reset other states
    setSelectedUser(null);
    setUserFriends([]);
    setShortestPath([]);
    setPathNodes([]);
    setPathLinks([]);
    setPathError(null);
    
    // Small delay to show loading state
    setTimeout(() => {
      setUsernameLoading(false);
    }, 100);
  };

  const handleUserChange = (newUsername: string) => {
    setCurrentUsername(newUsername);
    setSelectedUser(null);
    setUserFriends([]);
    setShortestPath([]);
    setPathNodes([]);
    setPathLinks([]);
    setPathError(null);
  };

  const handleNodeClick = async (nodeId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/users/${nodeId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to fetch user data (${response.status})`;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Validate the response data structure
      if (!data.user || typeof data.user.id !== 'number' || !data.user.username) {
        throw new Error('Invalid user data received from server');
      }
      
      setSelectedUser(data.user);
      setUserFriends(data.friends || []);
    } catch {
      // Error handled silently - could add toast notification here if needed
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    setCurrentUsername(null);
    setSelectedUser(null);
    setUserFriends([]);
    setShortestPath([]);
    setPathNodes([]);
    setPathLinks([]);
    setPathError(null);
  };

  const findShortestPath = async () => {
    if (!pathFromUser.trim() || !pathToUser.trim()) {
      setPathError('Please enter both usernames');
      return;
    }

    if (pathFromUser.trim() === pathToUser.trim()) {
      setPathError('Please enter different usernames');
      return;
    }

    setPathFinding(true);
    setPathError(null);
    // Clear previous path results immediately for better UX
    setShortestPath([]);
    setPathNodes([]);
    setPathLinks([]);
    
    try {
      const response = await fetch('/api/shortest-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromUser: pathFromUser.trim(),
          toUser: pathToUser.trim()
        })
      });

      const data = await response.json(); // Try to parse JSON regardless of ok status first

      if (!response.ok) {
        // Use error from JSON if available, otherwise generic
        throw new Error(data.error || `Failed to find path (status ${response.status})`);
      }

      setShortestPath(data.path || []);
      setPathNodes(data.pathNodes || []);
      setPathLinks(data.pathLinks || []);
      
      if (!data.path || data.path.length === 0) {
        setPathError('No path found between these users');
      }
    } catch (error) {
      setPathError(error instanceof Error ? error.message : 'An unknown error occurred while finding the path');
      setShortestPath([]); // Ensure path is cleared on error
      setPathNodes([]);
      setPathLinks([]);
    } finally {
      setPathFinding(false); // Crucial: always stop loading indicator
    }
  };

  const resetShortestPath = () => {
    setShortestPath([]);
    setPathNodes([]);
    setPathLinks([]);
    setPathError(null);
    setPathFromUser('');
    setPathToUser('');
  };

  return (
    <div className="min-h-screen bg-black">
      {!currentUsername ? (
        <div className="container mx-auto p-6">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              Roblox Network
            </h1>
            <p className="text-lg text-gray-300">
               A graph displaying a network of all your roblox friends
            </p>
          </div>
          <div className="flex items-center justify-center min-h-[60vh]">
            <UsernameInput onSubmit={handleUsernameSubmit} loading={usernameLoading} />
          </div>
        </div>
      ) : (
        <div className="relative w-full h-screen">
          {/* Fullscreen Network Graph */}
          <div className="absolute inset-0">
            <NetworkGraph 
              onNodeClick={handleNodeClick} 
              username={currentUsername}
              onUserChange={handleUserChange}
              shortestPath={shortestPath}
              pathNodes={pathNodes}
              pathLinks={pathLinks}
            />
          </div>

          {/* Top Left Stats Overlay */}
          <div className="absolute top-4 left-4 z-10">
            <Card className="bg-black/80 backdrop-blur border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white">Network for: {currentUsername}</CardTitle>
                <Button 
                  onClick={handleStartOver} 
                  variant="outline" 
                  size="sm"
                  className="mt-2 border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Try Different User
                </Button>
              </CardHeader>
              {selectedUser && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div>
                      <h3 className="font-semibold text-white">{selectedUser.username}</h3>
                      <p className="text-sm text-gray-400">ID: {selectedUser.id}</p>
                      <p className="text-sm text-gray-400">
                        Friends: {selectedUser.friends.length}
                      </p>
                    </div>
                    {loading && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                        Loading...
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Bottom Center Legend Overlay */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <Card className="bg-black/80 backdrop-blur border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-300">You</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-green-500"></div>
                    <span className="text-gray-300">Mutual friends</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-purple-500"></div>
                    <span className="text-gray-300">Friend connections</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-green-500 rounded-full bg-blue-500"></div>
                    <span className="text-gray-300">Expanded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-300">Shortest path</span>
                  </div>
                </div>
                                  <div className="mt-2 text-xs text-gray-400 text-center">
                    Click any node to expand/collapse their network • Red nodes show shortest path with numbers indicating order
                  </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Right - Shortest Path Finder */}
          <div className="absolute bottom-4 right-4 z-10 w-80">
            <Card className="bg-black/80 backdrop-blur border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white">Find Shortest Path</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">From user:</label>
                    <input
                      type="text"
                      placeholder="Enter username"
                      value={pathFromUser}
                      onChange={(e) => setPathFromUser(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">To user:</label>
                    <input
                      type="text"
                      placeholder="Enter username"
                      value={pathToUser}
                      onChange={(e) => setPathToUser(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && findShortestPath()}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={findShortestPath}
                      disabled={pathFinding}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      {pathFinding ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          Finding path...
                        </div>
                      ) : 'Find Path'}
                    </Button>
                    
                    {(shortestPath.length > 0 || pathNodes.length > 0) && (
                      <Button 
                        onClick={resetShortestPath}
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        size="sm"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  
                  {pathFinding && (
                    <div className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded">
                      This may take a few seconds to compute the shortest path and load context...
                    </div>
                  )}
                  
                  {pathError && (
                    <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                      {pathError}
                    </div>
                  )}
                  
                  {shortestPath.length > 0 && (
                    <div className="text-xs text-green-400 bg-green-900/20 p-2 rounded">
                      Path found! {shortestPath.length} degrees of separation. 
                      Showing path nodes + {pathFromUser.trim()}&apos;s direct friends for context.
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-400">
                    Shows the shortest connection path between any two users
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Friends List Overlay (Right Side) - Only show when user selected */}
          {selectedUser && userFriends.length > 0 && (
            <div className="absolute top-4 right-4 z-10 w-80">
              <Card className="bg-black/80 backdrop-blur border-gray-700 max-h-96 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white">Friends List</CardTitle>
                  <Button
                    onClick={() => {
                      setSelectedUser(null);
                      setUserFriends([]);
                    }}
                    variant="outline"
                    size="sm"
                    className="mt-2 border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    Close
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {userFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="p-2 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
                        onClick={() => handleNodeClick(friend.id)}
                      >
                        <p className="font-medium text-sm text-white">{friend.username}</p>
                        <p className="text-xs text-gray-400">
                          {friend.friends.length} friends
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
