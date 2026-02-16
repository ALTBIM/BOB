import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

export const runtime = 'nodejs';

// POST /api/bcf/topics/[id]/comments - Add comment to topic
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
  const body = await request.json().catch(() => ({}));
  const comment = body.comment?.trim();
  const mentions = body.mentions || []; // Array of user IDs mentioned

  if (!comment) {
    return NextResponse.json({ error: 'Kommentar kan ikke være tom.' }, { status: 400 });
  }

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
      { error: 'Ingen tilgang til å kommentere på denne BCF topic.' },
      { status: 403 }
    );
  }

  // Create comment
  const { data: newComment, error: createError } = await supabase
    .from('issue_comments')
    .insert({
      issue_id: topicId,
      user_id: user.id,
      comment,
      attachments: body.attachments || [],
    })
    .select('*, user:auth.users(id, email)')
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: topic.project_id,
    action: 'bcf_comment_added',
    entity_type: 'bcf_topic',
    entity_id: topicId,
    details: { comment_preview: comment.substring(0, 100) },
  });

  // Send notification to assigned user if different from commenter
  const { data: topicData } = await supabase
    .from('issues')
    .select('assigned_to, title')
    .eq('id', topicId)
    .single();

  if (topicData?.assigned_to && topicData.assigned_to !== user.id) {
    await supabase.from('notifications').insert({
      user_id: topicData.assigned_to,
      project_id: topic.project_id,
      type: 'bcf_comment',
      title: 'Ny kommentar på BCF topic',
      message: `Ny kommentar på: ${topicData.title}`,
      link: `/app/bcf/${topicId}`,
    });
  }

  // Send notifications to mentioned users
  if (mentions.length > 0) {
    const mentionNotifications = mentions
      .filter((mentionedUserId: string) => mentionedUserId !== user.id)
      .map((mentionedUserId: string) => ({
        user_id: mentionedUserId,
        project_id: topic.project_id,
        type: 'bcf_mention',
        title: 'Du ble nevnt i en BCF kommentar',
        message: `${user.email} nevnte deg i: ${topicData?.title || 'BCF topic'}`,
        link: `/app/bcf/${topicId}`,
      }));

    if (mentionNotifications.length > 0) {
      await supabase.from('notifications').insert(mentionNotifications);
    }
  }

  return NextResponse.json({ comment: newComment });
}
