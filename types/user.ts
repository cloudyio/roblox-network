export interface User {
  id: number; // Roblox user ID
  username: string;
  friends: number[]; // Array of friend IDs
  createdAt?: Date;
  avatar?: string; // Roblox avatar thumbnail URL
  badges?: Badge[]; // Recent badges
}

export interface NetworkNode {
  id: number;
  name: string;
  val?: number; // Size of the node
  color?: string;
  fx?: number; // Fixed x position
  fy?: number; // Fixed y position
}

export interface NetworkLink {
  source: number;
  target: number;
  color?: string;
  width?: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  iconImageId: number;
  displayName: string;
  enabled: boolean;
  awarder: {
    id: number;
    type: string;
  };
  statistics: {
    pastDayAwardedCount: number;
    awardedCount: number;
    winRatePercentage: number;
  };
  created: string;
  updated: string;
  thumbnailUrl?: string;
} 