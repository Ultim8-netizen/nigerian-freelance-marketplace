// src/components/profile/ProfileHeader.tsx
'use client';

import Image from 'next/image';
import { VerifiedBadge, ProfileVerifiedBadge } from '@/components/verification/VerifiedBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, Calendar, Shield } from 'lucide-react';
import Link from 'next/link';

interface ProfileHeaderProps {
  profile: {
    id: string;
    full_name: string;
    profile_image_url?: string;
    bio?: string;
    location?: string;
    university?: string;
    user_type: string;
    freelancer_rating: number;
    total_jobs_completed: number;
    created_at: string;
    liveness_verified?: boolean;
    identity_verified?: boolean;
  };
  isOwnProfile?: boolean;
}

export function ProfileHeader({ profile, isOwnProfile = false }: ProfileHeaderProps) {
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Avatar */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 relative">
            {profile.profile_image_url ? (
              <Image
                src={profile.profile_image_url}
                alt={profile.full_name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-400">
                {profile.full_name.charAt(0)}
              </div>
            )}
          </div>
          {/* Verified Badge Overlay */}
          {profile.liveness_verified && (
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 rounded-full border-4 border-white flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                {profile.liveness_verified && <VerifiedBadge variant="compact" />}
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="secondary">{profile.user_type}</Badge>
                {profile.university && (
                  <Badge variant="outline">{profile.university}</Badge>
                )}
              </div>
            </div>

            {isOwnProfile && !profile.liveness_verified && (
              <Link href="/verification/liveness">
                <Button size="sm" variant="outline" className="border-blue-600 text-blue-600">
                  <Shield className="w-4 h-4 mr-2" />
                  Get Verified
                </Button>
              </Link>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-gray-700 mb-4">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            {profile.freelancer_rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
                <span className="font-semibold">{profile.freelancer_rating.toFixed(1)}</span>
                <span className="text-gray-600">({profile.total_jobs_completed} jobs)</span>
              </div>
            )}
            
            {profile.location && (
              <div className="flex items-center gap-1 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{profile.location}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Member since {memberSince}</span>
            </div>
          </div>

          {/* Verification Status Banner */}
          {profile.liveness_verified && (
            <div className="mt-4">
              <ProfileVerifiedBadge />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}