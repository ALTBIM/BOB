import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

export const runtime = 'nodejs';

// GET /api/projects/[id]/members - Get project members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase ikke konfigurert.' }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || 'Ikke autentisert.' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    // Get project members from project_members table
    const { data: members, error } = await supabase
      .from('project_members')
      .select('user_id, access_level, users:auth.users(id, email, raw_user_meta_data)')
      .eq('project_id', projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format response
    const formattedMembers = members?.map(m => ({
      id: m.users?.id,
      email: m.users?.email,
      name: m.users?.raw_user_meta_data?.name || m.users?.raw_user_meta_data?.full_name,
      access_level: m.access_level,
    })) || [];

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    console.error('Failed to fetch project members:', error);
    return NextResponse.json(
      { error: 'Kunne ikke hente prosjektmedlemmer.' },
      { status: 500 }
    );
  }
}
