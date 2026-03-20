'use client';

import Image from 'next/image';
import { ProfileVerifiedBadge } from '@/components/verification/VerifiedBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MapPin, Calendar, Shield } from 'lucide-react';
import Link from 'next/link';
import { TrustBadge } from '@/components/ui/TrustBadge';

type TrustLevel = 'new' | 'verified' | 'trusted' | 'top_rated' | 'elite';

interface ProfileHeaderProps {
  profile: {
    id: string;
    full_name: string;
    profile_image_url?: string;
    bio?: string;
    location?: string;
    university?: string;
    user_type: string;
    trust_level: TrustLevel;
    trust_score: number;
    freelancer_rating: number;
    total_jobs_completed: number;
    created_at: string;
    liveness_verified: boolean;
    identity_verified?: boolean;
  };
  isOwnProfile?: boolean;
}

// ─── Admin masking helpers ────────────────────────────────────────────────────

const isAdmin = (userType: string): boolean => userType === 'admin';

/**
 * Full-size F9 Shield avatar rendered in place of an admin's real photo/initial.
 * Matches the w-32 h-32 container used in ProfileHeader.
 */
function F9ShieldAvatarLarge() {
  return (
    <div className="w-full h-full bg-blue-600 flex flex-col items-center justify-center gap-1">
      <Shield className="w-12 h-12 text-white" />
      <span className="text-white text-xs font-bold tracking-widest">F9</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileHeader({ profile, isOwnProfile = false }: ProfileHeaderProps) {
  const adminProfile = isAdmin(profile.user_type);

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex flex-col md:flex-row gap-6">

        {/* ── Avatar ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 relative">
            {adminProfile ? (
              // Admin: F9 Shield replaces photo/initial entirely
              <F9ShieldAvatarLarge />
            ) : profile.profile_image_url ? (
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

          {/* Liveness Verified Badge Overlay — only for non-admins */}
          {!adminProfile && profile.liveness_verified && (
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 rounded-full border-4 border-white flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* ── Info ───────────────────────────────────────────────────────── */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>

              {/* Name row */}
              <div className="flex items-center gap-2 mb-2">
                {adminProfile ? (
                  // Admin: display "F9" with a shield badge instead of real name
                  <>
                    <h1 className="text-2xl font-bold">F9</h1>
                    <div className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                      <Shield className="w-3 h-3" />
                      <span>F9 Platform</span>
                    </div>
                  </>
                ) : (
                  // Regular user: real name + trust badge
                  <>
                    <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                    <TrustBadge
                      level={profile.trust_level}
                      score={profile.trust_score}
                    />
                  </>
                )}
              </div>

              {/* User-type / university badges — hidden for admins */}
              {!adminProfile && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary">{profile.user_type}</Badge>
                  {profile.university && (
                    <Badge variant="outline">{profile.university}</Badge>
                  )}
                </div>
              )}
            </div>

            {/* "Get Verified" CTA — never shown on admin profiles */}
            {!adminProfile && isOwnProfile && !profile.liveness_verified && (
              <Link href="/verification/liveness">
                <Button size="sm" variant="outline" className="border-blue-600 text-blue-600">
                  <Shield className="w-4 h-4 mr-2" />
                  Get Verified
                </Button>
              </Link>
            )}
          </div>

          {/* Bio — hidden for admins */}
          {!adminProfile && profile.bio && (
            <p className="text-gray-700 mb-4">{profile.bio}</p>
          )}

          {/* Admin description copy shown instead */}
          {adminProfile && (
            <p className="text-gray-500 text-sm mb-4">
              Official F9 platform account. All communications from this profile are sent on behalf of the F9 team.
            </p>
          )}

          {/* Stats & Metadata — hidden for admins */}
          {!adminProfile && (
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
          )}

          {/* Verification banner — only for verified, non-admin users */}
          {!adminProfile && profile.liveness_verified && (
            <div className="mt-4">
              <ProfileVerifiedBadge />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}