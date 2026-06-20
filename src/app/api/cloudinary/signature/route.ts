// src/app/api/cloudinary/signature/route.ts
// Generate Cloudinary upload signature

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { v2 as cloudinary } from 'cloudinary';
import { logger } from '@/lib/logger';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Must match the folders this platform's uploader components actually pass
// to uploadImage() in src/lib/cloudinary/upload.ts:
//   - ImageUploader.tsx        → 'marketplace/services'
//   - ProfileImageUploader.tsx → 'marketplace/profiles'
//   - default                  → 'marketplace'
const allowedFolders = [
  'marketplace',
  'marketplace/services',
  'marketplace/profiles',
  'marketplace/products',
];

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      // FIX: was 'api' (100 req/min) — wildly looser than ImageUploader's
      // own stated client-side cap of 20 uploads/hour, making that cap
      // purely cosmetic (clear localStorage, get another 100/min from the
      // server). 'fileUpload' (20/hour) is the limiter this codebase
      // already defines specifically for this purpose — see
      // rateLimiterConfigs.fileUpload in lib/api/middleware.ts — and this
      // endpoint is the actual gate before a real upload can happen, so it
      // belongs here, matching the client's intended cap 1:1.
      rateLimit: 'fileUpload',
    });

    if (error || !user) return error || NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );

    const body = await request.json();
    const { folder = 'marketplace' } = body;

    // Validate folder name
    if (!allowedFolders.includes(folder)) {
      return NextResponse.json(
        { success: false, error: 'Invalid folder' },
        { status: 400 }
      );
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // IMPORTANT: only sign params actually sent to Cloudinary by the client
    // (see formData in src/lib/cloudinary/upload.ts: file, signature,
    // timestamp, api_key, folder). upload_preset is intentionally NOT signed
    // here because the client never sends it for signed uploads.
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET!
    );

    logger.info('Upload signature generated', { userId: user.id, folder });

    return NextResponse.json({
      signature,
      timestamp,
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
    });
  } catch (error) {
    logger.error('Signature generation error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate signature' },
      { status: 500 }
    );
  }
}