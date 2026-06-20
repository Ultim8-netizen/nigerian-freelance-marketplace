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
 * Extract a Cloudinary public ID from a stored value.
 *
 * Stored image fields (profiles.profile_image_url, services.images,
 * products.images, etc.) hold the full `secure_url` returned by Cloudinary
 * on upload, e.g.:
 *   https://res.cloudinary.com/<cloud>/image/upload/v1718900000/marketplace/services/abc123.jpg
 *
 * The public ID is everything after `/upload/`, with the leading version
 * segment (`v<digits>/`, if present) and file extension stripped:
 *   marketplace/services/abc123
 *
 * If the value is not a Cloudinary URL (no 'cloudinary.com'), it is returned
 * unchanged — callers that need to distinguish "real public ID" from
 * "unrelated external URL" should use resolveImageSource() instead, which
 * this function does not attempt (it's a pure string transform with no
 * knowledge of intent).
 */
export function extractPublicId(value: string): string {
  if (!value) return '';
  if (!value.includes('cloudinary.com')) return value;

  const afterUpload = value.split('/upload/').pop();
  if (!afterUpload) return value;

  return afterUpload
    .replace(/^v\d+\//, '')    // strip leading version segment, if present
    .replace(/\.[^/.]+$/, ''); // strip file extension
}

/**
 * Resolve a stored image value into either a Cloudinary public ID ready for
 * transformation, or a literal URL to pass through untransformed.
 *
 * This distinction matters because Cloudinary cannot apply transformations
 * to assets it doesn't host — if a stored value is a non-Cloudinary http URL
 * (e.g. a legacy avatar from before this platform used Cloudinary, or a
 * manually-set admin URL), running it through cld.image() would silently
 * produce a broken image. Used internally by the get*Url() helpers below.
 */
function resolveImageSource(
  value: string
): { type: 'id'; id: string } | { type: 'url'; url: string } | null {
  if (!value) return null;

  if (value.startsWith('http') && !value.includes('cloudinary.com')) {
    return { type: 'url', url: value };
  }

  const id = extractPublicId(value);
  return id ? { type: 'id', id } : null;
}

/**
 * Generate optimized Cloudinary URL with transformations
 */
export function getCloudinaryUrl(
  publicId: string,
  transformations?: (image: ReturnType<typeof cld.image>) => ReturnType<typeof cld.image>
): string {
  const resolved = resolveImageSource(publicId);
  if (!resolved) return '';
  if (resolved.type === 'url') return resolved.url;

  let image = cld.image(resolved.id);

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
  const resolved = resolveImageSource(publicId);
  if (!resolved) return '';
  if (resolved.type === 'url') return resolved.url;

  return cld.image(resolved.id)
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
  const resolved = resolveImageSource(publicId);
  if (!resolved) return '';
  if (resolved.type === 'url') return resolved.url;

  return cld.image(resolved.id)
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
  const resolved = resolveImageSource(publicId);
  if (!resolved) return '';
  if (resolved.type === 'url') return resolved.url;

  return cld.image(resolved.id)
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
  const resolved = resolveImageSource(publicId);
  if (!resolved) return '';
  if (resolved.type === 'url') return resolved.url;

  return cld.image(resolved.id)
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
  const resolved = resolveImageSource(publicId);
  if (!resolved) return '';
  if (resolved.type === 'url') return resolved.url;

  let image = cld.image(resolved.id);

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