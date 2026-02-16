import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';
import { UpdateBCFTopicRequest } from '@/types/bcf';

export const runtime = 'nodejs';

// GET /api/bcf/topics/[id] - Get topic details with viewpoints and comments
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

  const topicId = params.id;

  // Fetch topic
  const { data: topic, error: topicError } = await supabase
    .from('issues')
    .select('*, assigned_user:auth.users!assigned_to(id, email), created_user:auth.users!created_by(id, email)')
    .eq('id', topicId)
    .eq('type', 'bcf')
    .single();

  if (topicError || !topic) {
    return NextResponse.json(
      { error: 'BCF topic ikke funnet.' },
      { status: 404 }
    );
  }

  // Fetch viewpoints
  const { data: viewpoints } = await supabase
    .from('bcf_viewpoints')
    .select('*')
    .eq('issue_id', topicId)
    .order('index', { ascending: true });

  // Fetch comments with user info
  const { data: comments } = await supabase
    .from('issue_comments')
    .select('*, user:auth.users(id, email)')
    .eq('issue_id', topicId)
    .order('created_at', { ascending: true });

  // Fetch links
  const { data: links } = await supabase
    .from('bcf_topic_links')
    .select('*')
    .eq('issue_id', topicId);

  return NextResponse.json({
    topic,
    viewpoints: viewpoints || [],
    comments: comments || [],
    links: links || [],
  });
}

// PATCH /api/bcf/topics/[id] - Update topic
export async function PATCH(
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
  const body = (await request.json().catch(() => ({}))) as Partial<UpdateBCFTopicRequest>;

  // Fetch existing topic to check access and get old values
  const { data: existingTopic, error: fetchError } = await supabase
    .from('issues')
    .select('*')
    .eq('id', topicId)
    .eq('type', 'bcf')
    .single();

  if (fetchError || !existingTopic) {
    return NextResponse.json(
      { error: 'BCF topic ikke funnet.' },
      { status: 404 }
    );
  }

  // Verify project write access
  const { data: canWrite } = await supabase.rpc('can_project_write', {
    p_user_id: user.id,
    p_project_id: existingTopic.project_id,
  });

  if (!canWrite) {
    return NextResponse.json(
      { error: 'Ingen tilgang til å oppdatere denne BCF topic.' },
      { status: 403 }
    );
  }

  // Build update object
  const updates: Record<string, any> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.stage !== undefined) updates.stage = body.stage;
  if (body.discipline !== undefined) updates.discipline = body.discipline;
  if (body.labels !== undefined) updates.labels = body.labels;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;
  if (body.due_date !== undefined) updates.due_date = body.due_date;

  // Update topic
  const { data: updatedTopic, error: updateError } = await supabase
    .from('issues')
    .update(updates)
    .eq('id', topicId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // Log activity
  const changes: Record<string, any> = {};
  Object.keys(updates).forEach((key) => {
    if (existingTopic[key] !== updates[key]) {
      changes[key] = { from: existingTopic[key], to: updates[key] };
    }
  });

  if (Object.keys(changes).length > 0) {
    await supabase.from('activity_log').insert({
      user_id: user.id,
      project_id: existingTopic.project_id,
      action: 'bcf_topic_updated',
      entity_type: 'bcf_topic',
      entity_id: topicId,
      details: changes,
    });

    // Add to issue history
    await supabase.from('issue_history').insert({
      issue_id: topicId,
      user_id: user.id,
      action: 'updated',
      changes,
    });
  }

  // Send notification if assignment changed
  if (body.assigned_to && body.assigned_to !== existingTopic.assigned_to && body.assigned_to !== user.id) {
    await supabase.from('notifications').insert({
      user_id: body.assigned_to,
      project_id: existingTopic.project_id,
      type: 'bcf_assigned',
      title: 'BCF topic tildelt',
      message: `Du har blitt tildelt: ${updatedTopic.title}`,
      link: `/app/bcf/${topicId}`,
    });
  }

  return NextResponse.json({ topic: updatedTopic });
}

// DELETE /api/bcf/topics/[id] - Delete topic
export async function DELETE(
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

  // Fetch topic to check access
  const { data: topic, error: fetchError } = await supabase
    .from('issues')
    .select('*')
    .eq('id', topicId)
    .eq('type', 'bcf')
    .single();

  if (fetchError || !topic) {
    return NextResponse.json(
      { error: 'BCF topic ikke funnet.' },
      { status: 404 }
    );
  }

  // Verify project admin access (delete requires admin)
  const { data: canDelete } = await supabase.rpc('can_project_admin', {
    p_user_id: user.id,
    p_project_id: topic.project_id,
  });

  if (!canDelete) {
    return NextResponse.json(
      { error: 'Ingen tilgang til å slette denne BCF topic.' },
      { status: 403 }
    );
  }

  // Delete topic (cascade will delete viewpoints, comments, links)
  const { error: deleteError } = await supabase
    .from('issues')
    .delete()
    .eq('id', topicId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  // Log activity
  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: topic.project_id,
    action: 'bcf_topic_deleted',
    entity_type: 'bcf_topic',
    entity_id: topicId,
    details: { title: topic.title },
  });

  return NextResponse.json({ success: true });
}
