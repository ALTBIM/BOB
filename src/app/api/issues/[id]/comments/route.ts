import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Hent issue for å få project_id
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('project_id, title, assigned_to, created_by')
      .eq('id', params.id)
      .single();

    if (issueError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Verifiser tilgang til prosjekt (forenklet for testing uten RLS)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', issue.project_id)
      .single();
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { comment, attachments } = body;

    if (!comment || !comment.trim()) {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    }

    // Opprett kommentar
    const { data: newComment, error } = await supabase
      .from('issue_comments')
      .insert({
        issue_id: params.id,
        user_id: user.id,
        comment: comment.trim(),
        attachments: attachments || []
      })
      .select('*, user:user_id(id, email)')
      .single();

    if (error) {
      console.error('Create comment error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logg i historikk
    await supabase.from('issue_history').insert({
      issue_id: params.id,
      user_id: user.id,
      action: 'commented',
      changes: { comment: comment.substring(0, 100) }
    });

    // Logg aktivitet
    await supabase.from('activity_log').insert({
      user_id: user.id,
      project_id: issue.project_id,
      action: 'issue.commented',
      entity_type: 'issue',
      entity_id: params.id,
      details: { comment_id: newComment.id }
    });

    // Send varsler til relevante personer (unntatt kommentator)
    const notifyUsers = [issue.assigned_to, issue.created_by].filter(
      (id) => id && id !== user.id
    );

    for (const userId of notifyUsers) {
      await supabase.from('notifications').insert({
        user_id: userId,
        project_id: issue.project_id,
        type: 'issue_comment',
        title: 'Ny kommentar på issue',
        message: `${issue.title}: ${comment.substring(0, 50)}...`,
        link: `/projects/${issue.project_id}/issues/${params.id}`
      });
    }

    return NextResponse.json(newComment);

  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Hent issue for å få project_id
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('project_id')
      .eq('id', params.id)
      .single();

    if (issueError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Verifiser tilgang til prosjekt (forenklet for testing uten RLS)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', issue.project_id)
      .single();
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Hent kommentarer
    const { data: comments, error } = await supabase
      .from('issue_comments')
      .select('*, user:user_id(id, email)')
      .eq('issue_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get comments error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });

  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
