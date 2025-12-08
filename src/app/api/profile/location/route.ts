// src/app/api/profile/location/route.ts
// API endpoint to update user location

import { NextRequest, NextResponse } from 'next/server';
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
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = locationSchema.parse(body);

    // Update profile with location
    const { error } = await supabase
      .from('profiles')
      .update({
        location: validatedData.city 
          ? `${validatedData.city}, ${validatedData.state}`
          : validatedData.state,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}