import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { guid: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Verifiser autentisering
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const modelId = searchParams.get('model_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
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

    // Hent element
    let query = supabase
      .from('ifc_elements')
      .select('*')
      .eq('project_id', projectId)
      .eq('guid', params.guid);

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    const { data: elements, error } = await query;

    if (error) {
      console.error('Error fetching element:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!elements || elements.length === 0) {
      return NextResponse.json({ error: 'Element not found' }, { status: 404 });
    }

    const element = elements[0];

    // Hent relaterte issues
    const { data: relatedIssues } = await supabase
      .from('issues')
      .select('id, title, status, priority, type')
      .eq('project_id', projectId)
      .contains('ifc_element_guids', [params.guid])
      .limit(10);

    // Hent relaterte elementer (hvis det finnes relasjoner i properties)
    const relatedGuids = element.properties?.related_elements || [];
    let relatedElements: Array<{ guid: string; name: string; element_type: string }> = [];
    if (relatedGuids.length > 0) {
      const { data } = await supabase
        .from('ifc_elements')
        .select('guid, name, element_type')
        .eq('project_id', projectId)
        .in('guid', relatedGuids)
        .limit(20);
      relatedElements = data || [];
    }

    // Formater respons
    const response = {
      guid: element.guid,
      name: element.name,
      type: element.element_type,
      description: element.description,
      properties: element.properties || {},
      geometry: element.geometry,
      location: {
        floor: element.floor,
        zone: element.zone,
        room: element.room
      },
      material: element.material,
      fire_rating: element.fire_rating,
      status: element.status,
      supplier: element.supplier,
      responsible: element.responsible,
      related_elements: relatedElements,
      related_issues: relatedIssues || [],
      created_at: element.created_at
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching IFC element:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
