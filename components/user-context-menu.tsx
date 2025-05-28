'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/types/user';

interface UserContextMenuProps {
  userId: number;
  username: string;
  position: { x: number; y: number };
  onClose: () => void;
}

interface RobloxUserData {
  userId: number;
  avatar: string | null;
  badges: Badge[];
}

export function UserContextMenu({ userId, username, position, onClose }: UserContextMenuProps) {
  const [userData, setUserData] = useState<RobloxUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/roblox/user/${userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }
        
        const data = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-context-menu')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Position the menu to stay within viewport
  const getMenuStyle = () => {
    const menuWidth = 320;
    const menuHeight = 400;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position if menu would go off-screen
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

    // Adjust vertical position if menu would go off-screen
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    return {
      position: 'fixed' as const,
      left: `${x}px`,
      top: `${y}px`,
      zIndex: 1000,
    };
  };

  return (
    <div
      className="user-context-menu bg-black/90 backdrop-blur border border-gray-700 rounded-lg shadow-xl p-4 w-80"
      style={getMenuStyle()}
    >
      {/* Header with username */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{username}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-300">Loading...</span>
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded">
          Error: {error}
        </div>
      )}

      {userData && !loading && (
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex justify-center">
            {userData.avatar ? (
              <img
                src={userData.avatar}
                alt={`${username}'s avatar`}
                className="w-24 h-24 rounded-full border-2 border-gray-600"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                <span className="text-gray-400 text-sm">No Avatar</span>
              </div>
            )}
          </div>

          {/* User ID */}
          <div className="text-center">
            <span className="text-gray-400 text-sm">User ID: {userId}</span>
          </div>

          {/* Recent Badges */}
          <div>
            <h4 className="text-white font-medium mb-2">Recent Badges</h4>
            {userData.badges.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {userData.badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-3 p-2 bg-gray-800/50 rounded hover:bg-gray-700/50 transition-colors"
                  >
                    {badge.thumbnailUrl ? (
                      <img
                        src={badge.thumbnailUrl}
                        alt={badge.name}
                        className="w-8 h-8 rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                        <span className="text-xs text-gray-400">🏆</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {badge.displayName || badge.name}
                      </p>
                      {badge.description && (
                        <p className="text-gray-400 text-xs truncate">
                          {badge.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-sm text-center py-4">
                No recent badges found
              </div>
            )}
          </div>

          {/* View Profile Button */}
          <div className="pt-2 border-t border-gray-700">
            <a
              href={`https://www.roblox.com/users/${userId}/profile`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
            >
              View Roblox Profile
            </a>
          </div>
        </div>
      )}
    </div>
  );
} 