import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

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

    // Hent issue
    const { data: issue, error } = await supabase
      .from('issues')
      .select('*, created_by_user:created_by(id, email), assigned_to_user:assigned_to(id, email)')
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
      }
      console.error('Error fetching issue:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    return NextResponse.json(issue);

  } catch (error) {
    console.error('Error fetching issue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    // Hent eksisterende issue for å få project_id
    const { data: existingIssue, error: fetchError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingIssue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Verifiser tilgang til prosjekt (forenklet for testing uten RLS)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', existingIssue.project_id)
      .single();
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};
    const changes: Record<string, any> = {};

    // Tillatte felter å oppdatere
    const allowedFields = [
      'title',
      'description',
      'status',
      'priority',
      'category',
      'assigned_to',
      'due_date',
      'ifc_element_guids',
      'attachments'
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
        if ((existingIssue as any)[field] !== body[field]) {
          changes[field] = {
            from: (existingIssue as any)[field],
            to: body[field]
          };
        }
      }
    }

    // Sett resolved_at hvis status endres til 'avklart' eller 'lukket'
    if (updates.status && ['avklart', 'lukket'].includes(updates.status)) {
      if (!['avklart', 'lukket'].includes(existingIssue.status)) {
        updates.resolved_at = new Date().toISOString();
      }
    }

    // Oppdater issue
    const { data: updatedIssue, error } = await supabase
      .from('issues')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Update issue error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logg endringer i historikk
    if (Object.keys(changes).length > 0) {
      await supabase.from('issue_history').insert({
        issue_id: params.id,
        user_id: user.id,
        action: 'updated',
        changes
      });
    }

    // Logg aktivitet
    await supabase.from('activity_log').insert({
      user_id: user.id,
      project_id: existingIssue.project_id,
      action: 'issue.updated',
      entity_type: 'issue',
      entity_id: params.id,
      details: changes
    });

    // Send varsel hvis assigned_to endres
    if (updates.assigned_to && updates.assigned_to !== existingIssue.assigned_to) {
      await supabase.from('notifications').insert({
        user_id: updates.assigned_to,
        project_id: existingIssue.project_id,
        type: 'issue_assigned',
        title: 'Issue tildelt deg',
        message: updatedIssue.title,
        link: `/projects/${existingIssue.project_id}/issues/${params.id}`
      });
    }

    // Send varsel hvis status endres
    if (updates.status && updates.status !== existingIssue.status) {
      const notifyUsers = [existingIssue.assigned_to, updatedIssue.created_by].filter(
        (id) => id && id !== user.id
      );
      
      for (const userId of notifyUsers) {
        await supabase.from('notifications').insert({
          user_id: userId,
          project_id: existingIssue.project_id,
          type: 'issue_status_changed',
          title: `Issue status endret til ${updates.status}`,
          message: updatedIssue.title,
          link: `/projects/${existingIssue.project_id}/issues/${params.id}`
        });
      }
    }

    return NextResponse.json(updatedIssue);

  } catch (error) {
    console.error('Update issue error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('project_id, title')
      .eq('id', params.id)
      .single();

    if (fetchError || !issue) {
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

    // Slett issue (cascade vil slette kommentarer og historikk)
    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Delete issue error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logg aktivitet
    await supabase.from('activity_log').insert({
      user_id: user.id,
      project_id: issue.project_id,
      action: 'issue.deleted',
      entity_type: 'issue',
      entity_id: params.id,
      details: { title: issue.title }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete issue error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
