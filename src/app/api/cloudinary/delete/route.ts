// src/app/api/cloudinary/delete/route.ts
// Delete a Cloudinary asset by public ID. Counterpart to /api/cloudinary/signature.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { deleteImage } from '@/lib/cloudinary/admin';
import { logger } from '@/lib/logger';

// Must match the folders this platform actually uploads into — see
// allowedFolders in /api/cloudinary/signature/route.ts.
const ALLOWED_FOLDER_PREFIXES = [
  'marketplace/services',
  'marketplace/profiles',
  'marketplace/products',
  'marketplace',
];

function isValidPublicId(publicId: string): boolean {
  if (!publicId) return false;
  if (publicId.includes('..')) return false;
  if (publicId.startsWith('/')) return false;
  if (/\s/.test(publicId)) return false;

  return ALLOWED_FOLDER_PREFIXES.some((prefix) => publicId.startsWith(`${prefix}/`));
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'fileUpload',
    });

    if (error || !user) {
      return error || NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const publicId = typeof body?.publicId === 'string' ? body.publicId.trim() : '';

    if (!publicId) {
      return NextResponse.json(
        { success: false, error: 'publicId is required' },
        { status: 400 }
      );
    }

    // NOTE: This confirms the requester is authenticated and the asset lives
    // in a folder this platform manages — it does NOT confirm the requester
    // owns this specific asset. There is no per-image ownership table to
    // check against (images live inline in profiles.profile_image_url,
    // services.images, products.images, etc., not in their own table keyed
    // by uploader). Closing that gap requires passing resource context
    // (table + row id + column) from the caller and verifying ownership
    // against that row before deleting — out of scope for this endpoint
    // until that contract is defined.
    if (!isValidPublicId(publicId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or disallowed asset path' },
        { status: 400 }
      );
    }

    const deleted = await deleteImage(publicId);

    if (!deleted) {
      logger.error(
        'Cloudinary delete route error',
        new Error(`Cloudinary deletion unsuccessful for publicId=${publicId} userId=${user.id}`)
      );
      return NextResponse.json(
        { success: false, error: 'Failed to delete image' },
        { status: 502 }
      );
    }

    logger.info('Cloudinary asset deleted', { userId: user.id, publicId });

    return NextResponse.json({ success: true, publicId });
  } catch (error) {
    logger.error('Cloudinary delete route error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}