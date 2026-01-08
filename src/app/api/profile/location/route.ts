// src/app/api/profile/location/route.ts
// API endpoint to update user location

import { NextRequest, NextResponse } from 'next/server';
import { applyMiddleware } from '@/lib/api/enhanced-middleware';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const locationSchema = z.object({
  state: z.string().min(1, 'State is required'),
  city: z.string().optional(),
  area: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  detection_method: z.enum(['manual', 'browser', 'ip']),
});

export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await applyMiddleware(request, {
      auth: 'required',
      rateLimit: 'api',
    });

    if (error) return error;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = locationSchema.parse(body);

    const supabase = await createClient();

    // Upsert profile with location (insert if not exists, update if exists)
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id, // Mandatory for upsert
        email: user.email, // Ensure email is present
        full_name: user.user_metadata?.full_name || '', // Ensure name is present
        location: validatedData.city 
          ? `${validatedData.city}, ${validatedData.state}`
          : validatedData.state,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Store detailed location in separate table (optional)
    await supabase
      .from('user_locations')
      .upsert({
        user_id: user.id,
        state: validatedData.state,
        city: validatedData.city,
        area: validatedData.area,
        coordinates: validatedData.coordinates,
        detection_method: validatedData.detection_method,
        last_updated: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      message: 'Location updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}