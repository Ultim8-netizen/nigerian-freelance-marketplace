/ ============================================================================
// src/lib/cloudinary/monitoring.ts
// Track Cloudinary usage to stay within free tier

interface CloudinaryUsage {
  transformations: number;
  bandwidth: number; // in bytes
  storage: number; // in bytes
  lastChecked: Date;
}

/**
 * Monitor Cloudinary usage (simplified tracking)
 * In production, use Cloudinary's Admin API for accurate data
 */
export class CloudinaryMonitor {
  private static readonly STORAGE_KEY = 'cloudinary_usage';

  static getUsage(): CloudinaryUsage {
    if (typeof window === 'undefined') {
      return {
        transformations: 0,
        bandwidth: 0,
        storage: 0,
        lastChecked: new Date(),
      };
    }

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    return {
      transformations: 0,
      bandwidth: 0,
      storage: 0,
      lastChecked: new Date(),
    };
  }

  static trackTransformation() {
    const usage = this.getUsage();
    usage.transformations += 1;
    usage.lastChecked = new Date();
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(usage));
    }

    // Warn if approaching limits
    if (usage.transformations > 20000) {
      console.warn('Approaching Cloudinary transformation limit');
    }
  }

  static trackBandwidth(bytes: number) {
    const usage = this.getUsage();
    usage.bandwidth += bytes;
    usage.lastChecked = new Date();
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(usage));
    }

    const GB = 1024 * 1024 * 1024;
    if (usage.bandwidth > 20 * GB) {
      console.warn('Approaching Cloudinary bandwidth limit');
    }
  }

  static resetMonthly() {
    const usage: CloudinaryUsage = {
      transformations: 0,
      bandwidth: 0,
      storage: 0,
      lastChecked: new Date(),
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(usage));
    }
  }
}

// ============================================================================
// USAGE EXAMPLES IN YOUR EXISTING COMPONENTS

// Update ServiceCard component to use optimized images:
// Replace direct image usage with:

import { OptimizedImage } from '@/components/cloudinary/OptimizedImage';

// In ServiceCard:
<OptimizedImage
  src={service.images?.[0] || '/placeholder-service.png'}
  alt={service.title}
  width={400}
  height={300}
  quality="auto:good"
  className="object-cover"
/>

// For service detail page with gallery:
<ImageGallery 
  images={service.images || []} 
  alt={service.title}
/>

// For profile images:
<OptimizedImage
  src={user.profile_image_url}
  alt={user.full_name}
  width={200}
  height={200}
  quality="auto:good"
  className="rounded-full"
/>