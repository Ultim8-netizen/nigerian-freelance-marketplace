// src/components/profile/ProfileHeader.tsx
'use client';

import Image from 'next/image';
import { VerifiedBadge, ProfileVerifiedBadge } from '@/components/verification/VerifiedBadge'; // From File 1
import { Badge } from '@/components/ui/badge'; // From File 1
import { Button } from '@/components/ui/button'; // From File 1
import { Star, MapPin, Calendar, Shield } from 'lucide-react'; // From File 1
import Link from 'next/link'; // From File 1
import { TrustBadge } from '@/components/ui/TrustBadge'; // New component from File 2

interface ProfileHeaderProps {
  profile: {
    id: string;
    full_name: string;
    profile_image_url?: string;
    bio?: string; // From File 1
    location?: string;
    university?: string;
    user_type: string; // From File 1
    trust_level: string; // From File 2
    trust_score: number; // From File 2
    freelancer_rating: number;
    total_jobs_completed: number;
    created_at: string; // From File 1
    liveness_verified: boolean; // Merged: now non-optional
    identity_verified?: boolean; // From File 1
  };
  isOwnProfile?: boolean; // From File 1
}

export function ProfileHeader({ profile, isOwnProfile = false }: ProfileHeaderProps) {
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    // Structure and styling from File 1 (more detailed)
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
              // Combining avatar fallback styles: Use File 1 structure with a more visible color (File 2) if desired, but kept File 1's gray for neutrality.
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-400">
                {profile.full_name.charAt(0)}
              </div>
            )}
          </div>
          {/* Liveness Verified Badge Overlay (File 1 Style) */}
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
              {/* Name and Verification/Trust Badges */}
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                
                {/* Use TrustBadge from File 2 next to the name */}
                <TrustBadge 
                  level={profile.trust_level as any}
                  score={profile.trust_score}
                  // Optionally add a className if needed for size adjustment
                />
                
                {/* VerifiedBadge from File 1, if TrustBadge isn't the primary verification visual */}
                {/* {profile.liveness_verified && <VerifiedBadge variant="compact" />} */}
              </div>
              
              {/* User Type and University Badges (From File 1) */}
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="secondary">{profile.user_type}</Badge>
                {profile.university && (
                  <Badge variant="outline">{profile.university}</Badge>
                )}
              </div>
            </div>

            {/* Get Verified Button (From File 1) */}
            {isOwnProfile && !profile.liveness_verified && (
              <Link href="/verification/liveness">
                <Button size="sm" variant="outline" className="border-blue-600 text-blue-600">
                  <Shield className="w-4 h-4 mr-2" />
                  Get Verified
                </Button>
              </Link>
            )}
          </div>

          {/* Bio (From File 1) */}
          {profile.bio && (
            <p className="text-gray-700 mb-4">{profile.bio}</p>
          )}

          {/* Stats & Metadata */}
          <div className="flex flex-wrap gap-4 text-sm">
            {/* Rating Stat (From File 1, includes total jobs) */}
            {profile.freelancer_rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" />
                <span className="font-semibold">{profile.freelancer_rating.toFixed(1)}</span>
                <span className="text-gray-600">({profile.total_jobs_completed} jobs)</span>
              </div>
            )}
            
            {/* Location Stat (From File 1) */}
            {profile.location && (
              <div className="flex items-center gap-1 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{profile.location}</span>
              </div>
            )}
            
            {/* Member Since Stat (From File 1) */}
            <div className="flex items-center gap-1 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Member since {memberSince}</span>
            </div>
          </div>

          {/* Verification Status Banner (From File 1) */}
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