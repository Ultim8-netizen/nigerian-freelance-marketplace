/**
 * Extended Types for Components
 *
 * This file contains extended versions of database types that include
 * relations and computed fields used in components but not present in
 * the raw database schema.
 */

// Import directly from database.types to avoid circular reference
import type { Tables } from './database.types';

// Import other types from index (these don't cause circular refs)
import type { Job, Order } from './index';

// Get the raw database Profile type
type DatabaseProfile = Tables<'profiles'>;

/**
 * Extended Profile type with properly typed fields.
 *
 * The database generates these as generic strings/nullables, but we need
 * literal unions for type-safe consumption in components and API routes:
 *
 * - user_type:          'string' → 'client' | 'freelancer' | 'both' | 'admin'
 *                       'admin' is required by the admin API route which checks
 *                       profile.user_type !== 'admin'. Without it the check
 *                       would never narrow correctly.
 * - account_status:     'string' → 'active' | 'suspended' | 'banned'
 * - onboarding_completed: 'boolean | null' → 'boolean'
 */
export type Profile = Omit<
  DatabaseProfile,
  'user_type' | 'account_status' | 'onboarding_completed'
> & {
  user_type: 'client' | 'freelancer' | 'both' | 'admin';
  account_status: 'active' | 'suspended' | 'banned';
  onboarding_completed: boolean;
};

/**
 * Job type with client relation populated.
 * Used when displaying job listings with client information.
 */
export type JobWithClient = Job & {
  client?: Pick<Profile, 'id' | 'full_name' | 'location' | 'profile_image_url'> | null;
};

/**
 * Job type with full client profile.
 * Used in job detail pages.
 */
export type JobWithFullClient = Job & {
  client: Profile | null;
};

/**
 * Order type with client and freelancer relations populated.
 * Used when displaying order cards and details.
 */
export type OrderWithRelations = Order & {
  client?: Pick<Profile, 'id' | 'full_name' | 'profile_image_url' | 'location'> | null;
  freelancer?: Pick<Profile, 'id' | 'full_name' | 'profile_image_url' | 'location'> | null;
};

/**
 * Order type with full client and freelancer profiles.
 * Used in order detail pages that need complete profile information.
 */
export type OrderWithFullRelations = Order & {
  client: Profile | null;
  freelancer: Profile | null;
};

// ============================================================================
// SERVICE TYPES WITH RELATIONS
// ============================================================================

/**
 * Raw freelancer data from database (before transformation).
 * Allows null values as they come from the database.
 */
export type ServiceFreelancerRaw = {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  freelancer_rating: number | null;
  total_jobs_completed: number | null;
};

/**
 * Transformed freelancer data for component consumption.
 * Matches ServiceCardProps expectations exactly.
 */
export type ServiceFreelancer = {
  id: string;
  full_name: string;
  profile_image_url?: string;
  freelancer_rating: number;
  total_jobs_completed: number;
  liveness_verified?: boolean;
};

/**
 * Raw service with freelancer relation from Supabase.
 */
export type ServiceWithFreelancerRaw = Tables<'services'> & {
  freelancer: ServiceFreelancerRaw | null;
};

/**
 * Service type for display in components - matches ServiceCardProps.
 */
export type ServiceDisplay = Tables<'services'> & {
  freelancer?: ServiceFreelancer;
};