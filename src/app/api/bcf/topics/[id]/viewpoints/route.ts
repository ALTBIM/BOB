import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';
import { CreateBCFViewpointRequest } from '@/types/bcf';

export const runtime = 'nodejs';

// POST /api/bcf/topics/[id]/viewpoints - Add viewpoint to topic
export async function POST(
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

  const topicId = params.id;
  const body = (await request.json().catch(() => ({}))) as Partial<CreateBCFViewpointRequest>;

  // Verify topic exists and user has access
  const { data: topic, error: topicError } = await supabase
    .from('issues')
    .select('project_id')
    .eq('id', topicId)
    .eq('type', 'bcf')
    .single();

  if (topicError || !topic) {
    return NextResponse.json({ error: 'BCF topic ikke funnet.' }, { status: 404 });
  }

  // Verify project write access
  const { data: canWrite } = await supabase.rpc('can_project_write', {
    p_user_id: user.id,
    p_project_id: topic.project_id,
  });

  if (!canWrite) {
    return NextResponse.json(
      { error: 'Ingen tilgang til å legge til viewpoint.' },
      { status: 403 }
    );
  }

  // Create viewpoint using helper function
  const { data: viewpointId, error: createError } = await supabase.rpc('add_bcf_viewpoint', {
    p_issue_id: topicId,
    p_camera_position: body.camera_position || null,
    p_camera_direction: body.camera_direction || null,
    p_camera_up: body.camera_up || null,
    p_snapshot_url: body.snapshot_url || null,
    p_selected_elements: body.selected_elements || [],
    p_visible_elements: body.visible_elements || [],
    p_hidden_elements: body.hidden_elements || [],
  });

  if (createError || !viewpointId) {
    return NextResponse.json(
      { error: createError?.message || 'Kunne ikke opprette viewpoint.' },
      { status: 500 }
    );
  }

  // If snapshot data is provided (base64), we need to update it separately
  if (body.snapshot_data) {
    await supabase
      .from('bcf_viewpoints')
      .update({
        snapshot_data: body.snapshot_data,
        snapshot_type: body.snapshot_data.startsWith('data:image/png') ? 'png' : 'jpg',
      })
      .eq('id', viewpointId);
  }

  // Fetch created viewpoint
  const { data: viewpoint } = await supabase
    .from('bcf_viewpoints')
    .select('*')
    .eq('id', viewpointId)
    .single();

  // Log activity
  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: topic.project_id,
    action: 'bcf_viewpoint_added',
    entity_type: 'bcf_topic',
    entity_id: topicId,
    details: { viewpoint_id: viewpointId },
  });

  return NextResponse.json({ viewpoint });
}
