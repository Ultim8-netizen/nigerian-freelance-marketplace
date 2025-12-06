// src/lib/cloudinary/config.ts
// Cloudinary configuration and URL generation

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}`;

/**
 * Generate optimized Cloudinary URL with transformations
 */
export function getCloudinaryUrl(
  publicId: string,
  transformations: string = ''
): string {
  if (!publicId) return '';
  
  // If it's already a full URL, return as-is
  if (publicId.startsWith('http')) return publicId;
  
  // Build Cloudinary URL
  return `${CLOUDINARY_BASE_URL}/image/upload/${transformations}/${publicId}`;
}

/**
 * Get thumbnail (small preview) version
 * 200x200, auto format, quality auto:good
 */
export function getThumbnailUrl(publicId: string): string {
  return getCloudinaryUrl(
    publicId,
    'w_200,h_200,c_fill,f_auto,q_auto:good'
  );
}

/**
 * Get card image (medium size for listings)
 * 400x300, auto format, quality auto:good
 */
export function getCardImageUrl(publicId: string): string {
  return getCloudinaryUrl(
    publicId,
    'w_400,h_300,c_fill,f_auto,q_auto:good'
  );
}

/**
 * Get full-size image for lightbox/detail view
 * 1200px width, maintain aspect ratio
 */
export function getFullImageUrl(publicId: string): string {
  return getCloudinaryUrl(
    publicId,
    'w_1200,c_limit,f_auto,q_auto:good'
  );
}

/**
 * Get profile image (circular avatar)
 * 200x200, circular crop
 */
export function getProfileImageUrl(publicId: string): string {
  return getCloudinaryUrl(
    publicId,
    'w_200,h_200,c_fill,g_face,f_auto,q_auto:good'
  );
}

/**
 * Get optimized image with custom transformations
 */
export function getOptimizedImageUrl(
  publicId: string,
  width?: number,
  height?: number,
  quality: 'auto:low' | 'auto:good' | 'auto:best' = 'auto:good'
): string {
  const transformations: string[] = [];
  
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  transformations.push('c_fill');
  transformations.push('f_auto');
  transformations.push(`q_${quality}`);
  
  return getCloudinaryUrl(publicId, transformations.join(','));
}

export const cloudinaryConfig = {
  cloudName: CLOUDINARY_CLOUD_NAME,
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default',
  apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '',
};