import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';
import { CreateBCFTopicRequest, BCFTopicFilters } from '@/types/bcf';

export const runtime = 'nodejs';

// GET /api/bcf/topics - List BCF topics with filters
export async function GET(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase ikke konfigurert.' }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || 'Ikke autentisert.' }, { status: 401 });
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('per_page') || '30');
  
  // Filters
  const status = searchParams.get('status')?.split(',').filter(Boolean) || [];
  const priority = searchParams.get('priority')?.split(',').filter(Boolean) || [];
  const assignedTo = searchParams.getAll('assigned_to');
  const labels = searchParams.getAll('labels');
  const discipline = searchParams.get('discipline');
  const stage = searchParams.get('stage');
  const search = searchParams.get('search');
  const createdAfter = searchParams.get('created_after');
  const createdBefore = searchParams.get('created_before');
  const assignedToMe = searchParams.get('assigned_to_me') === 'true';
  const unassigned = searchParams.get('unassigned') === 'true';
  const sortBy = searchParams.get('sort_by') || 'updated_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  if (!projectId) {
    return NextResponse.json({ error: 'project_id er påkrevd.' }, { status: 400 });
  }

  // Build query - only fetch essential fields for list view
  let query = supabase
    .from('issues')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .eq('type', 'bcf');

  // Apply filters
  if (status.length > 0) {
    query = query.in('status', status);
  }
  if (priority.length > 0) {
    query = query.in('priority', priority);
  }
  if (assignedTo.length > 0) {
    query = query.in('assigned_to', assignedTo);
  }
  if (discipline) {
    query = query.eq('discipline', discipline);
  }
  if (stage) {
    query = query.eq('stage', stage);
  }
  if (labels.length > 0) {
    query = query.overlaps('labels', labels);
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (createdAfter) {
    query = query.gte('created_at', createdAfter);
  }
  if (createdBefore) {
    query = query.lte('created_at', createdBefore);
  }
  if (assignedToMe) {
    query = query.eq('assigned_to', user.id);
  }
  if (unassigned) {
    query = query.is('assigned_to', null);
  }

  // Sorting
  query = query.order(sortBy as any, { ascending: sortOrder === 'asc' });

  // Pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data: topics, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    topics: topics || [],
    total: count || 0,
    page,
    per_page: perPage,
  });
}

// POST /api/bcf/topics - Create new BCF topic
export async function POST(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase ikke konfigurert.' }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || 'Ikke autentisert.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<CreateBCFTopicRequest>;

  if (!body.project_id || !body.title) {
    return NextResponse.json(
      { error: 'project_id og title er påkrevd.' },
      { status: 400 }
    );
  }

  // Verify project access
  const { data: projectAccess } = await supabase
    .rpc('can_project_write', {
      p_user_id: user.id,
      p_project_id: body.project_id,
    });

  if (!projectAccess) {
    return NextResponse.json(
      { error: 'Ingen tilgang til dette prosjektet.' },
      { status: 403 }
    );
  }

  // Create BCF topic using the helper function
  const { data: topicId, error: createError } = await supabase.rpc('create_bcf_topic', {
    p_project_id: body.project_id,
    p_title: body.title,
    p_description: body.description || null,
    p_status: body.status || 'open',
    p_priority: body.priority || 'medium',
    p_stage: body.stage || null,
    p_discipline: body.discipline || null,
    p_labels: body.labels || [],
    p_assigned_to: body.assigned_to || null,
    p_due_date: body.due_date || null,
    p_ifc_element_guids: body.ifc_element_guids || [],
  });

  if (createError || !topicId) {
    return NextResponse.json(
      { error: createError?.message || 'Kunne ikke opprette BCF topic.' },
      { status: 500 }
    );
  }

  // Add viewpoint if provided
  if (body.viewpoint) {
    const { error: viewpointError } = await supabase.rpc('add_bcf_viewpoint', {
      p_issue_id: topicId,
      p_camera_position: body.viewpoint.camera_position || null,
      p_camera_direction: body.viewpoint.camera_direction || null,
      p_camera_up: body.viewpoint.camera_up || null,
      p_snapshot_url: body.viewpoint.snapshot_url || null,
      p_selected_elements: body.viewpoint.selected_elements || [],
      p_visible_elements: body.viewpoint.visible_elements || [],
      p_hidden_elements: body.viewpoint.hidden_elements || [],
    });

    if (viewpointError) {
      console.error('Failed to create viewpoint:', viewpointError);
    }
  }

  // Log activity
  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: body.project_id,
    action: 'bcf_topic_created',
    entity_type: 'bcf_topic',
    entity_id: topicId,
    details: { title: body.title },
  });

  // Send notification if assigned
  if (body.assigned_to && body.assigned_to !== user.id) {
    await supabase.from('notifications').insert({
      user_id: body.assigned_to,
      project_id: body.project_id,
      type: 'bcf_assigned',
      title: 'Ny BCF topic tildelt',
      message: `Du har blitt tildelt: ${body.title}`,
      link: `/app/bcf/${topicId}`,
    });
  }

  // Fetch the created topic
  const { data: topic } = await supabase
    .from('issues')
    .select('*')
    .eq('id', topicId)
    .single();

  return NextResponse.json({ topic });
}
