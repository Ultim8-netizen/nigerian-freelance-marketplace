// src/lib/cloudinary/monitor.ts
// Track Cloudinary usage to stay within free tier
// SERVER-SIDE ONLY - Uses Service Role Key

import 'server-only';
import { createClient } from '@supabase/supabase-js';

// =================================================================
// SUPABASE INTEGRATION (SERVER-SIDE WITH SERVICE ROLE)
// =================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role for elevated permissions on server-side operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// =================================================================
// CLOUDINARY USAGE TRACKING
// =================================================================

const CLOUDINARY_USAGE_TABLE = 'cloudinary_usage';
const USAGE_ROW_ID = 'global';

interface CloudinaryUsage {
  id?: string;
  transformations: number;
  bandwidth: number; // in bytes
  storage: number; // in bytes
  last_checked: string; // ISO string for Supabase
}

const DEFAULT_USAGE: CloudinaryUsage = {
  id: USAGE_ROW_ID,
  transformations: 0,
  bandwidth: 0,
  storage: 0,
  last_checked: new Date().toISOString(),
};

/**
 * Monitor Cloudinary usage (simplified tracking).
 * Uses Supabase with Service Role for server-side operations.
 * 
 * IMPORTANT: Only import this in server-side code:
 * - API routes
 * - Server Components
 * - Server Actions
 */
export class CloudinaryMonitor {
  /**
   * Fetches the current usage data from Supabase.
   */
  static async getUsage(): Promise<CloudinaryUsage> {
    try {
      const { data, error } = await supabaseAdmin
        .from(CLOUDINARY_USAGE_TABLE)
        .select('*')
        .eq('id', USAGE_ROW_ID)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is 'no rows found'
        console.error("Supabase Error fetching Cloudinary usage:", error);
      }

      if (data) {
        return data as CloudinaryUsage;
      }
      return DEFAULT_USAGE;
    } catch (error) {
      console.error("General Error fetching Cloudinary usage from Supabase:", error);
      return DEFAULT_USAGE;
    }
  }

  /**
   * Saves the current usage data to Supabase using upsert.
   */
  private static async saveUsage(usage: CloudinaryUsage): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from(CLOUDINARY_USAGE_TABLE)
        .upsert({
          id: USAGE_ROW_ID,
          transformations: usage.transformations,
          bandwidth: usage.bandwidth,
          storage: usage.storage,
          last_checked: new Date().toISOString(),
        })
        .select();
        
      if (error) {
        console.error("Supabase Error saving Cloudinary usage:", error);
      }
    } catch (error) {
      console.error("General Error saving Cloudinary usage to Supabase:", error);
    }
  }

  /**
   * Tracks a single image transformation.
   * Call this after successful Cloudinary uploads.
   */
  static async trackTransformation() {
    const usage = await this.getUsage();
    usage.transformations += 1;
    
    await this.saveUsage(usage);

    // Warn if approaching limits (free tier is 25,000)
    if (usage.transformations > 20000) {
      console.warn('⚠️ Cloudinary: Approaching transformation limit', {
        current: usage.transformations,
        limit: 25000,
      });
    }
  }

  /**
   * Tracks bandwidth usage in bytes.
   * Call this when images are served/viewed.
   * @param bytes The amount of bandwidth consumed.
   */
  static async trackBandwidth(bytes: number) {
    const usage = await this.getUsage();
    usage.bandwidth += bytes;
    
    await this.saveUsage(usage);

    const GB = 1024 * 1024 * 1024;
    // Warn if approaching limits (free tier is 25 GB)
    if (usage.bandwidth > 20 * GB) { // 20 GB warning threshold
      console.warn('⚠️ Cloudinary: Approaching bandwidth limit', {
        current: `${(usage.bandwidth / GB).toFixed(2)} GB`,
        limit: '25 GB',
      });
    }
  }

  /**
   * Tracks storage usage in bytes.
   * Call this after successful uploads.
   * @param bytes The amount of storage consumed.
   */
  static async trackStorage(bytes: number) {
    const usage = await this.getUsage();
    usage.storage += bytes;
    
    await this.saveUsage(usage);

    const GB = 1024 * 1024 * 1024;
    // Warn if approaching limits (free tier is 25 GB)
    if (usage.storage > 20 * GB) { // 20 GB warning threshold
      console.warn('⚠️ Cloudinary: Approaching storage limit', {
        current: `${(usage.storage / GB).toFixed(2)} GB`,
        limit: '25 GB',
      });
    }
  }

  /**
   * Resets all usage counters. Should be called manually or scheduled monthly.
   * Create a cron job or scheduled function to call this on the 1st of each month.
   */
  static async resetMonthly() {
    await this.saveUsage(DEFAULT_USAGE);
    console.log('✅ Cloudinary usage counters reset for new month');
  }

  /**
   * Gets usage statistics in a human-readable format.
   * Use this for admin dashboards.
   */
  static async getUsageStats() {
    const usage = await this.getUsage();
    const GB = 1024 * 1024 * 1024;

    return {
      transformations: {
        current: usage.transformations,
        limit: 25000,
        percentage: ((usage.transformations / 25000) * 100).toFixed(2) + '%',
        remaining: 25000 - usage.transformations,
      },
      bandwidth: {
        current: (usage.bandwidth / GB).toFixed(2) + ' GB',
        limit: '25 GB',
        percentage: ((usage.bandwidth / (25 * GB)) * 100).toFixed(2) + '%',
        remaining: ((25 * GB - usage.bandwidth) / GB).toFixed(2) + ' GB',
      },
      storage: {
        current: (usage.storage / GB).toFixed(2) + ' GB',
        limit: '25 GB',
        percentage: ((usage.storage / (25 * GB)) * 100).toFixed(2) + '%',
        remaining: ((25 * GB - usage.storage) / GB).toFixed(2) + ' GB',
      },
      lastChecked: new Date(usage.last_checked).toLocaleString(),
    };
  }
}