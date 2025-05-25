'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface UsernameInputProps {
  onSubmit: (username: string) => void;
  loading?: boolean;
}

export function UsernameInput({ onSubmit, loading = false }: UsernameInputProps) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSubmit(username.trim());
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Enter Your Username</CardTitle>
        <CardDescription>
          View a network of all your friends and their friends!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Roblox Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
              disabled={loading}
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !username.trim()}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Loading Network...
              </div>
            ) : (
              'Visualize My Network'
            )}
          </Button>
        </form>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>• Your network will show your friends and their connections</p>
          <p>• You&apos;ll appear as a red node in the center</p>
          <p>• Click on a friend to expand the network</p>
        </div>
      </CardContent>
    </Card>
  );
} 