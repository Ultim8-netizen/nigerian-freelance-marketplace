/**
 * Extended Types for Components
 * 
 * This file contains extended versions of database types that include
 * relations and computed fields used in components but not present in
 * the raw database schema.
 */

import type { Job, Profile, Order } from './index';

/**
 * Job type with client relation populated
 * Used when displaying job listings with client information
 */
export type JobWithClient = Job & {
  client?: Pick<Profile, 'id' | 'full_name' | 'location' | 'profile_image_url'> | null;
};

/**
 * Job type with full client profile
 * Used in job detail pages
 */
export type JobWithFullClient = Job & {
  client: Profile | null;
};

/**
 * Order type with client and freelancer relations populated
 * Used when displaying order cards and details
 */
export type OrderWithRelations = Order & {
  client?: Pick<Profile, 'id' | 'full_name' | 'profile_image_url' | 'location'> | null;
  freelancer?: Pick<Profile, 'id' | 'full_name' | 'profile_image_url' | 'location'> | null;
};

/**
 * Order type with full client and freelancer profiles
 * Used in order detail pages that need complete profile information
 */
export type OrderWithFullRelations = Order & {
  client: Profile | null;
  freelancer: Profile | null;
};

/**
 * Add other extended types as needed
 */