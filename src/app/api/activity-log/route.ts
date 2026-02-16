import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

export const runtime = 'nodejs';

// GET /api/activity-log - Get activity logs with filters
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
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');
  const userId = searchParams.get('user_id');
  const action = searchParams.get('action');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!projectId) {
    return NextResponse.json({ error: 'project_id er påkrevd.' }, { status: 400 });
  }

  try {
    // Build query
    let query = supabase
      .from('activity_log')
      .select('*, user:auth.users(email, name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (action) {
      query = query.eq('action', action);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    console.error('Failed to fetch activity logs:', error);
    return NextResponse.json(
      { error: 'Kunne ikke hente aktivitetslogg.' },
      { status: 500 }
    );
  }
}
