import { NextResponse } from 'next/server';
import { Badge } from '@/types/user';

interface RobloxBadgeResponse {
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
}

interface RobloxThumbnailResponse {
  targetId: number;
  state: string;
  imageUrl: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Fetch user avatar thumbnail
    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    );
    
    let avatarUrl = null;
    if (avatarResponse.ok) {
      const avatarData = await avatarResponse.json();
      if (avatarData.data && avatarData.data.length > 0) {
        avatarUrl = avatarData.data[0].imageUrl;
      }
    }

    // Fetch user badges (recent ones)
    const badgesResponse = await fetch(
      `https://badges.roblox.com/v1/users/${userId}/badges?limit=10&sortOrder=Desc`
    );
    
    let badges: Badge[] = [];
    if (badgesResponse.ok) {
      const badgesData = await badgesResponse.json();
      if (badgesData.data) {
        badges = badgesData.data.map((badge: RobloxBadgeResponse) => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          iconImageId: badge.iconImageId,
          displayName: badge.displayName,
          enabled: badge.enabled,
          awarder: badge.awarder,
          statistics: badge.statistics,
          created: badge.created,
          updated: badge.updated
        }));
      }
    }

    // Get badge thumbnails for the first few badges
    if (badges.length > 0) {
      const badgeIds = badges.slice(0, 5).map(badge => badge.id).join(',');
      const badgeThumbnailsResponse = await fetch(
        `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${badgeIds}&size=150x150&format=Png&isCircular=false`
      );
      
      if (badgeThumbnailsResponse.ok) {
        const thumbnailData = await badgeThumbnailsResponse.json();
        if (thumbnailData.data) {
          // Map thumbnails to badges
          const thumbnailMap = new Map();
          thumbnailData.data.forEach((thumb: RobloxThumbnailResponse) => {
            thumbnailMap.set(thumb.targetId, thumb.imageUrl);
          });
          
          badges = badges.map(badge => ({
            ...badge,
            thumbnailUrl: thumbnailMap.get(badge.id)
          }));
        }
      }
    }

    return NextResponse.json({
      userId,
      avatar: avatarUrl,
      badges: badges.slice(0, 5) // Return only the 5 most recent badges
    });

  } catch (error) {
    console.error('Error fetching Roblox user data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch Roblox user data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 