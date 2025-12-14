// src/lib/cloudinary/config.ts
// Cloudinary configuration and URL generation using @cloudinary/url-gen

import { Cloudinary } from '@cloudinary/url-gen';
import { fill, scale, limitFit } from '@cloudinary/url-gen/actions/resize';
import { auto } from '@cloudinary/url-gen/qualifiers/quality';
import { auto as autoFormat } from '@cloudinary/url-gen/qualifiers/format';
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity';
import { AutoFocus } from '@cloudinary/url-gen/qualifiers/autoFocus';
import { FocusOn } from '@cloudinary/url-gen/qualifiers/focusOn';
import { format } from '@cloudinary/url-gen/actions/delivery';
import { quality } from '@cloudinary/url-gen/actions/delivery';

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';

// Initialize Cloudinary instance
const cld = new Cloudinary({
  cloud: {
    cloudName: CLOUDINARY_CLOUD_NAME
  },
  url: {
    secure: true
  }
});

/**
 * Generate optimized Cloudinary URL with transformations
 */
export function getCloudinaryUrl(
  publicId: string,
  transformations?: (image: ReturnType<typeof cld.image>) => ReturnType<typeof cld.image>
): string {
  if (!publicId) return '';
  
  // If it's already a full URL, return as-is
  if (publicId.startsWith('http')) return publicId;
  
  // Build Cloudinary URL with transformations
  let image = cld.image(publicId);
  
  if (transformations) {
    image = transformations(image);
  }
  
  return image.toURL();
}

/**
 * Get thumbnail (small preview) version
 * 200x200, auto format, quality auto:good
 */
export function getThumbnailUrl(publicId: string): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;
  
  return cld.image(publicId)
    .resize(fill().width(200).height(200))
    .delivery(format(autoFormat()))
    .delivery(quality(auto()))
    .toURL();
}

/**
 * Get card image (medium size for listings)
 * 400x300, auto format, quality auto:good
 */
export function getCardImageUrl(publicId: string): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;
  
  return cld.image(publicId)
    .resize(fill().width(400).height(300))
    .delivery(format(autoFormat()))
    .delivery(quality(auto()))
    .toURL();
}

/**
 * Get full-size image for lightbox/detail view
 * 1200px width, maintain aspect ratio
 */
export function getFullImageUrl(publicId: string): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;
  
  return cld.image(publicId)
    .resize(limitFit().width(1200))
    .delivery(format(autoFormat()))
    .delivery(quality(auto()))
    .toURL();
}

/**
 * Get profile image (circular avatar)
 * 200x200, circular crop with face detection
 */
export function getProfileImageUrl(publicId: string): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;
  
  return cld.image(publicId)
    .resize(
      fill()
        .width(200)
        .height(200)
        .gravity(autoGravity().autoFocus(AutoFocus.focusOn(FocusOn.faces())))
    )
    .delivery(format(autoFormat()))
    .delivery(quality(auto()))
    .toURL();
}

/**
 * Get optimized image with custom transformations
 */
export function getOptimizedImageUrl(
  publicId: string,
  width?: number,
  height?: number
): string {
  if (!publicId) return '';
  if (publicId.startsWith('http')) return publicId;
  
  let image = cld.image(publicId);
  
  // Apply resize transformation
  if (width && height) {
    image = image.resize(fill().width(width).height(height));
  } else if (width) {
    image = image.resize(scale().width(width));
  } else if (height) {
    image = image.resize(scale().height(height));
  }
  
  // Apply delivery optimizations
  image = image
    .delivery(format(autoFormat()))
    .delivery(quality(auto()));
  
  return image.toURL();
}

// Export Cloudinary instance for advanced usage
export { cld };

export const cloudinaryConfig = {
  cloudName: CLOUDINARY_CLOUD_NAME,
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'marketplace_unsigned',
  apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '',
};