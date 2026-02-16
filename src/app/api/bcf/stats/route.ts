import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

export const runtime = 'nodejs';

// GET /api/bcf/stats - Get BCF statistics for a project
export async function GET(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase ikke konfigurert.' }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || 'Ikke autentisert.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'project_id er påkrevd.' }, { status: 400 });
  }

  try {
    // Get total count
    const { count: totalCount } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('type', 'bcf');

    // Get counts by status
    const { data: statusCounts } = await supabase
      .from('issues')
      .select('status')
      .eq('project_id', projectId)
      .eq('type', 'bcf');

    // Get counts by priority
    const { data: priorityCounts } = await supabase
      .from('issues')
      .select('priority')
      .eq('project_id', projectId)
      .eq('type', 'bcf');

    // Calculate status breakdown
    const statusBreakdown = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };

    statusCounts?.forEach((item: any) => {
      if (item.status in statusBreakdown) {
        statusBreakdown[item.status as keyof typeof statusBreakdown]++;
      }
    });

    // Calculate priority breakdown
    const priorityBreakdown = {
      kritisk: 0,
      høy: 0,
      medium: 0,
      lav: 0,
    };

    priorityCounts?.forEach((item: any) => {
      if (item.priority in priorityBreakdown) {
        priorityBreakdown[item.priority as keyof typeof priorityBreakdown]++;
      }
    });

    // Get recently updated topics (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentlyUpdated } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('type', 'bcf')
      .gte('updated_at', sevenDaysAgo.toISOString());

    return NextResponse.json({
      total: totalCount || 0,
      statusBreakdown,
      priorityBreakdown,
      recentlyUpdated: recentlyUpdated || 0,
      activeCount: statusBreakdown.open + statusBreakdown.in_progress,
    });
  } catch (error) {
    console.error('Failed to get BCF stats:', error);
    return NextResponse.json(
      { error: 'Kunne ikke hente BCF statistikk.' },
      { status: 500 }
    );
  }
}
