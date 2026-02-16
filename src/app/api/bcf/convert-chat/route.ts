import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

export const runtime = 'nodejs';

// POST /api/bcf/convert-chat - Convert chat conversation to BCF topic
export async function POST(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase ikke konfigurert.' }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || 'Ikke autentisert.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { project_id, chat_thread_id, title, messages } = body;

  if (!project_id || !title) {
    return NextResponse.json(
      { error: 'project_id og title er påkrevd.' },
      { status: 400 }
    );
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'Minst én melding er påkrevd.' },
      { status: 400 }
    );
  }

  try {
    // Verify project access
    const { data: canWrite } = await supabase.rpc('can_project_write', {
      p_user_id: user.id,
      p_project_id: project_id,
    });

    if (!canWrite) {
      return NextResponse.json(
        { error: 'Ingen tilgang til dette prosjektet.' },
        { status: 403 }
      );
    }

    // Build description from messages
    let description = 'Konvertert fra chat:\n\n';
    messages.forEach((msg: any, idx: number) => {
      const author = msg.author === 'user' ? 'Bruker' : 'BOB';
      description += `[${author}]: ${msg.content}\n\n`;
    });

    // Create BCF topic
    const { data: topicId, error: createError } = await supabase.rpc('create_bcf_topic', {
      p_project_id: project_id,
      p_title: title,
      p_description: description.trim(),
      p_status: 'open',
      p_priority: 'medium',
      p_stage: null,
      p_discipline: null,
      p_labels: ['chat-konvertert'],
      p_assigned_to: null,
      p_due_date: null,
      p_ifc_element_guids: [],
    });

    if (createError || !topicId) {
      return NextResponse.json(
        { error: createError?.message || 'Kunne ikke opprette BCF topic.' },
        { status: 500 }
      );
    }

    // Link to chat thread if provided
    if (chat_thread_id) {
      await supabase.from('bcf_topic_links').insert({
        issue_id: topicId,
        link_type: 'chat_thread',
        linked_entity_id: chat_thread_id,
        metadata: { source: 'chat_conversion' },
      });
    }

    // Add comments from chat messages (skip the first one as it's in description)
    if (messages.length > 3) {
      // Only add extra comments if there are more than 3 messages
      for (let i = 3; i < Math.min(messages.length, 10); i++) {
        const msg = messages[i];
        await supabase.from('issue_comments').insert({
          issue_id: topicId,
          user_id: user.id,
          comment: `[${msg.author === 'user' ? 'Bruker' : 'BOB'}]: ${msg.content}`,
        });
      }
    }

    // Log activity
    await supabase.from('activity_log').insert({
      user_id: user.id,
      project_id: project_id,
      action: 'bcf_topic_created_from_chat',
      entity_type: 'bcf_topic',
      entity_id: topicId,
      details: {
        chat_thread_id,
        message_count: messages.length,
      },
    });

    return NextResponse.json({
      success: true,
      topic_id: topicId,
      message: 'BCF topic opprettet fra chat',
    });
  } catch (error) {
    console.error('Failed to convert chat to BCF:', error);
    return NextResponse.json(
      { error: 'Kunne ikke konvertere chat til BCF topic.' },
      { status: 500 }
    );
  }
}
