// src/app/api/cloudinary/confirm/route.ts
// Records upload-completion usage stats after a signed client-side upload
// finishes. Signed uploads go directly from the browser to Cloudinary, so
// this server otherwise never learns an upload happened or how large it
// was — without this endpoint, CloudinaryMonitor (lib/cloudinary/monitoring.ts)
// has no data source and its free-tier usage tracking stays permanently at
// zero. Called once, fire-and-forget, from uploadImage() in
// lib/cloudinary/upload.ts immediately after a successful upload.

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { CloudinaryMonitor } from '@/lib/cloudinary/monitoring';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      // 'api' (100/min), NOT 'fileUpload' — this call is bookkeeping for an
      // upload that already happened and was already gated by the
      // signature endpoint's 'fileUpload' limiter. Sharing that bucket here
      // would make every successful upload cost 2 tokens against the same
      // 20/hour quota instead of 1, silently halving the real upload
      // allowance the client is told it has.
      rateLimit: 'api',
    });

    if (error || !user) {
      return error || NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const bytes = typeof body?.bytes === 'number' && body.bytes > 0 ? body.bytes : 0;

    if (bytes > 0) {
      await CloudinaryMonitor.trackStorage(bytes);
    }

    // Proxy metric, not a precise count of real Cloudinary transformation
    // requests (those happen at Cloudinary's edge whenever a derived URL —
    // thumbnail, card, full, profile — is first generated, which this
    // server can't see without a Cloudinary webhook). Counted once per
    // upload, matching this module's own documented intent — see the
    // docstring on CloudinaryMonitor.trackTransformation().
    await CloudinaryMonitor.trackTransformation();

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Cloudinary confirm route error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to record usage' },
      { status: 500 }
    );
  }
}