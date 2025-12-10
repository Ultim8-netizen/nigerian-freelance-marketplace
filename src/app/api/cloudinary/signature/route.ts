// src/app/api/cloudinary/signature/route.ts
// Generate Cloudinary upload signature
// ============================================================================

import { NextRequest as NR, NextResponse as NRes } from 'next/server';
import { requireAuth as reqAuth } from '@/lib/api/middleware';
import { checkRateLimit as limitCheck } from '@/lib/rate-limit-upstash';
import { v2 as cloudinary } from 'cloudinary';
import { logger } from '@/lib/logger';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NR) {
  try {
    const authResult = await reqAuth(request);
    if (authResult instanceof NRes) return authResult;
    const { user } = authResult;

    const rateLimitResult = await limitCheck('api', user.id);
    if (!rateLimitResult.success) {
      return NRes.json(
        { success: false, error: 'Too many requests', resetAt: rateLimitResult.reset },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { folder = 'marketplace' } = body;

    // Validate folder name
    const allowedFolders = ['marketplace', 'services', 'profiles', 'products'];
    if (!allowedFolders.includes(folder)) {
      return NRes.json(
        { success: false, error: 'Invalid folder' },
        { status: 400 }
      );
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
        upload_preset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      },
      process.env.CLOUDINARY_API_SECRET!
    );

    logger.info('Upload signature generated', { userId: user.id, folder });

    return NRes.json({
      signature,
      timestamp,
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
    });
  } catch (error) {
    logger.error('Signature generation error', error as Error);
    return NRes.json(
      { success: false, error: 'Failed to generate signature' },
      { status: 500 }
    );
  }
}