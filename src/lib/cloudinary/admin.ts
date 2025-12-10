// ============================================================================
// src/lib/cloudinary/admin.ts
// Server-side Cloudinary operations (delete, manage)

import 'server-only';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary (server-side only)
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Delete image from Cloudinary (server-side only)
 * Use this when users delete their content
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Failed to delete image:', error);
    return false;
  }
}

/**
 * Delete multiple images
 */
export async function deleteMultipleImages(publicIds: string[]): Promise<number> {
  try {
    const result = await cloudinary.api.delete_resources(publicIds);
    return Object.keys(result.deleted).length;
  } catch (error) {
    console.error('Failed to delete images:', error);
    return 0;
  }
}

/**
 * Get image details and metadata
 */
export async function getImageDetails(publicId: string) {
  try {
    const result = await cloudinary.api.resource(publicId);
    return {
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      created_at: result.created_at,
    };
  } catch (error) {
    console.error('Failed to get image details:', error);
    return null;
  }
}