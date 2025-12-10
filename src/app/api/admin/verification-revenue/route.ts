// src/app/api/admin/verification-revenue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin (you should have an is_admin field in profiles)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get revenue stats
    const { data: revenueData } = await supabase
      .from('platform_revenue')
      .select('*')
      .eq('revenue_type', 'nin_verification')
      .order('created_at', { ascending: false });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalRevenue = revenueData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const todayRevenue = revenueData?.filter(item => 
      new Date(item.created_at) >= today
    ).reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const weekRevenue = revenueData?.filter(item => 
      new Date(item.created_at) >= weekAgo
    ).reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const monthRevenue = revenueData?.filter(item => 
      new Date(item.created_at) >= monthAgo
    ).reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    // Get recent verifications with user names
    const recentVerifications = await Promise.all(
      (revenueData?.slice(0, 10) || []).map(async (item) => {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', item.source_user_id)
          .single();

        return {
          id: item.id,
          user_name: userProfile?.full_name || 'Unknown User',
          amount: Number(item.amount),
          created_at: item.created_at,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        total_revenue: totalRevenue,
        today_revenue: todayRevenue,
        this_week_revenue: weekRevenue,
        this_month_revenue: monthRevenue,
        total_verifications: revenueData?.length || 0,
        recent_verifications: recentVerifications,
      },
    });

  } catch (error: any) {
    console.error('Revenue stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch revenue stats' },
      { status: 500 }
    );
  }
}