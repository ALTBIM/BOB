import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      project_id,
      type,
      title,
      description,
      priority,
      category,
      assigned_to,
      due_date,
      ifc_element_guids,
      attachments
    } = body;

    if (!project_id || !type || !title) {
      return NextResponse.json(
        { error: 'project_id, type, and title are required' },
        { status: 400 }
      );
    }

    // Verifiser tilgang til prosjekt (forenklet for testing uten RLS)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .single();
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Opprett issue
    const { data: issue, error } = await supabase
      .from('issues')
      .insert({
        project_id,
        type,
        title,
        description: description || null,
        priority: priority || 'medium',
        category: category || null,
        assigned_to: assigned_to || null,
        due_date: due_date || null,
        ifc_element_guids: ifc_element_guids || [],
        attachments: attachments || [],
        created_by: user.id,
        status: 'ny'
      })
      .select()
      .single();

    if (error) {
      console.error('Create issue error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logg aktivitet
    await supabase.from('activity_log').insert({
      user_id: user.id,
      project_id,
      action: 'issue.created',
      entity_type: 'issue',
      entity_id: issue.id,
      details: { title, type, priority }
    });

    // Send varsel til tildelt person
    if (assigned_to && assigned_to !== user.id) {
      await supabase.from('notifications').insert({
        user_id: assigned_to,
        project_id,
        type: 'issue_assigned',
        title: `Nytt ${type} tildelt deg`,
        message: title,
        link: `/projects/${project_id}/issues/${issue.id}`
      });
    }

    return NextResponse.json(issue);

  } catch (error) {
    console.error('Create issue error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assigned_to');
    const createdBy = searchParams.get('created_by');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Verifiser tilgang til prosjekt (forenklet for testing uten RLS)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Bygg query
    let query = supabase
      .from('issues')
      .select('*, created_by_user:created_by(id, email), assigned_to_user:assigned_to(id, email)', { count: 'exact' })
      .eq('project_id', projectId);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    if (priority) query = query.eq('priority', priority);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (createdBy) query = query.eq('created_by', createdBy);

    query = query.order('created_at', { ascending: false });

    const { data: issues, error, count } = await query;

    if (error) {
      console.error('Get issues error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Hent statistikk
    const { data: allIssues } = await supabase
      .from('issues')
      .select('status, priority')
      .eq('project_id', projectId);

    const byStatus = (allIssues || []).reduce((acc: Record<string, number>, issue: any) => {
      acc[issue.status] = (acc[issue.status] || 0) + 1;
      return acc;
    }, {});

    const byPriority = (allIssues || []).reduce((acc: Record<string, number>, issue: any) => {
      acc[issue.priority] = (acc[issue.priority] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      issues: issues || [],
      total: count || 0,
      stats: {
        by_status: byStatus,
        by_priority: byPriority
      }
    });

  } catch (error) {
    console.error('Get issues error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
