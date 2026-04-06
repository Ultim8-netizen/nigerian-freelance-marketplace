// src/app/profile/[id]/page.tsx
// Public-facing profile page — rendered when any user clicks on another
// user's profile link anywhere in the platform.
//
// ── Admin gate (spec requirement) ────────────────────────────────────────────
// If the requested profile belongs to an admin (user_type === 'admin'), the
// page renders ONLY:
//   • The F9 shield avatar
//   • The "F9" name + "F9 Platform" badge
//   • The official platform description copy
// No real name, no photo, no bio, no service listings, no order history,
// no reviews, no stats — nothing that could identify the admin as a person.
//
// ── Regular users ─────────────────────────────────────────────────────────────
// Full profile: ProfileHeader + active services + received reviews.
//
// ── Type strategy ─────────────────────────────────────────────────────────────
// Every query uses .single<T>() / .returns<T[]>() with an explicit type param.
// Relying on Supabase's select-string inference causes TypeScript to collapse
// the result to GenericStringError for multi-column selects, stripping all
// column types. The explicit generic is the correct and stable pattern.
//
// Next.js 15: params is a Promise and must be awaited before access.

import { notFound }      from 'next/navigation';
import { Shield, Star, MapPin, Calendar, Package } from 'lucide-react';
import { createClient }  from '@/lib/supabase/server';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import type { Tables }   from '@/types/database.types';

// ─── Page props ───────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

// ─── Row types ────────────────────────────────────────────────────────────────

type ProfileRow = Tables<'profiles'>;

type ServiceRow = Pick<
  Tables<'services'>,
  'id' | 'title' | 'base_price' | 'category' | 'delivery_days' | 'orders_count' | 'views_count'
>;

// Base review columns selected from the reviews table.
type ReviewBase = Pick<Tables<'reviews'>, 'id' | 'rating' | 'review_text' | 'created_at'>;

// Shape Supabase actually returns: the FK join `reviewer_id(...)` comes back
// as an object keyed under `reviewer_id`, not `reviewer`.
type ReviewRaw = ReviewBase & {
  reviewer_id: { full_name: string | null; profile_image_url: string | null } | null;
};

// Component-friendly shape after remapping reviewer_id → reviewer.
type ReviewRow = ReviewBase & {
  reviewer: { full_name: string | null; profile_image_url: string | null } | null;
};

// ─── Admin public profile ─────────────────────────────────────────────────────

/**
 * Rendered in place of the full profile when user_type === 'admin'.
 * Spec: "No personal information displayed. No service listings, no order
 * history visible to other users. The profile page shows only: the F9 name,
 * shield badge, and a short platform description."
 */
function AdminPublicProfile() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 flex flex-col items-center text-center gap-6">

          {/* Shield avatar */}
          <div className="w-28 h-28 rounded-full bg-blue-600 flex flex-col items-center justify-center gap-1 shadow-md">
            <Shield className="w-12 h-12 text-white" />
            <span className="text-white text-xs font-bold tracking-widest">F9</span>
          </div>

          {/* Name + badge */}
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">F9</h1>
            <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-sm font-semibold">
              <Shield className="w-3.5 h-3.5" />
              F9 Platform
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-500 text-sm leading-relaxed max-w-md">
            Official F9 platform account. All communications from this profile
            are sent on behalf of the F9 team.
          </p>

          <div className="w-full border-t border-gray-100" />

          <p className="text-xs text-gray-400">
            This is a verified platform account. F9 staff never request payments
            or personal information outside of official platform channels.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({ service }: { service: ServiceRow }) {
  return (
    <a
      href={`/services/${service.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
          {service.title}
        </h3>
        <span className="shrink-0 text-sm font-bold text-gray-900">
          ₦{Number(service.base_price).toLocaleString('en-NG')}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="bg-gray-100 rounded-full px-2 py-0.5 capitalize">
          {service.category}
        </span>
        <span>{service.delivery_days}d delivery</span>
        {(service.orders_count ?? 0) > 0 && (
          <span>{service.orders_count} orders</span>
        )}
      </div>
    </a>
  );
}

// ─── Review item ──────────────────────────────────────────────────────────────

function ReviewItem({ review }: { review: ReviewRow }) {
  const name = review.reviewer?.full_name ?? 'Anonymous';
  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-NG', {
        day:   'numeric',
        month: 'short',
        year:  'numeric',
      })
    : null;

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-800">{name}</span>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${
                i < review.rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-200'
              }`}
            />
          ))}
          {date && (
            <span className="ml-2 text-xs text-gray-400">{date}</span>
          )}
        </div>
      </div>
      {review.review_text && (
        <p className="text-sm text-gray-600 leading-relaxed">{review.review_text}</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // ── 1. Fetch profile ───────────────────────────────────────────────────────
  // .single<ProfileRow>() provides the explicit type.
  // Without this generic, Supabase TS inference resolves multi-column selects
  // as GenericStringError, stripping every property access below.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    notFound();
  }

  // ── 2. Admin gate ─────────────────────────────────────────────────────────
  // Exits before any further DB query runs. No service or review data is ever
  // fetched for admin profiles — the gate is structural, not just visual.
  if (profile.user_type === 'admin') {
    return <AdminPublicProfile />;
  }

  // ── 3. Viewer identity ────────────────────────────────────────────────────
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const isOwnProfile = viewer?.id === id;

  // ── 4. Fetch public data (parallel, after admin gate clears) ──────────────

  const [servicesResult, reviewsResult] = await Promise.all([
    // Active services only — drafts and deactivated listings are not public.
    supabase
      .from('services')
      .select('id, title, base_price, category, delivery_days, orders_count, views_count')
      .eq('freelancer_id', id)
      .eq('is_active', true)
      .order('orders_count', { ascending: false })
      .limit(12)
      .returns<ServiceRow[]>(),

    // Reviews received by this user. FK join: reviewer_id(full_name, profile_image_url)
    // resolves as { reviewer_id: { ... } } on the raw row — remapped below.
    supabase
      .from('reviews')
      .select('id, rating, review_text, created_at, reviewer_id(full_name, profile_image_url)')
      .eq('reviewee_id', id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<ReviewRaw[]>(),
  ]);

  const services: ServiceRow[] = servicesResult.data ?? [];

  // Remap FK join key (reviewer_id) to component-friendly key (reviewer).
  const reviews: ReviewRow[] = (reviewsResult.data ?? []).map((r) => ({
    id:          r.id,
    rating:      r.rating,
    review_text: r.review_text,
    created_at:  r.created_at,
    reviewer:    r.reviewer_id,
  }));

  // ── 5. Account status ─────────────────────────────────────────────────────
  const isSuspended = profile.account_status === 'suspended';
  const isBanned    = profile.account_status === 'banned';

  // ── 6. Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

        {/* ── Account status banners ── */}
        {isBanned && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
            This account has been permanently banned from the F9 platform.
          </div>
        )}
        {isSuspended && !isBanned && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 font-medium">
            This account is currently suspended.
          </div>
        )}

        {/* ── Profile header ── */}
        <ProfileHeader
          profile={{
            id:                   profile.id,
            full_name:            profile.full_name,
            profile_image_url:    profile.profile_image_url ?? undefined,
            bio:                  profile.bio ?? undefined,
            location:             profile.location ?? undefined,
            university:           profile.university ?? undefined,
            user_type:            profile.user_type,
            trust_level:          (profile.trust_level ?? 'new') as
              'new' | 'verified' | 'trusted' | 'top_rated' | 'elite',
            trust_score:          profile.trust_score ?? 0,
            freelancer_rating:    profile.freelancer_rating ?? 0,
            total_jobs_completed: profile.total_jobs_completed ?? 0,
            created_at:           profile.created_at ?? new Date().toISOString(),
            liveness_verified:    profile.liveness_verified ?? false,
            identity_verified:    profile.identity_verified ?? false,
          }}
          isOwnProfile={isOwnProfile}
        />

        {/* ── Service listings (freelancers only) ── */}
        {(profile.user_type === 'freelancer' || profile.user_type === 'both') && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">
                Services
                {services.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({services.length})
                  </span>
                )}
              </h2>
            </div>

            {services.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                {isOwnProfile
                  ? 'You have no active services yet.'
                  : 'This freelancer has no active services.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Reviews ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">
              Reviews
              {reviews.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({reviews.length})
                </span>
              )}
            </h2>
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No reviews yet.</p>
          ) : (
            <div>
              {reviews.map((review) => (
                <ReviewItem key={review.id} review={review} />
              ))}
            </div>
          )}
        </section>

        {/* ── Meta footer ── */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-4">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {profile.location}
            </span>
          )}
          {profile.created_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Member since{' '}
              {new Date(profile.created_at).toLocaleDateString('en-NG', {
                month: 'long',
                year:  'numeric',
              })}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}