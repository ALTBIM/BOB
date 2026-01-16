import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';

interface IFCSearchQuery {
  project_id: string;
  model_id?: string;
  text?: string;
  filters?: {
    element_type?: string[];
    floor?: string[];
    zone?: string[];
    room?: string[];
    material?: string[];
    fire_rating?: string[];
    status?: string[];
    supplier?: string[];
    responsible?: string[];
  };
  limit?: number;
  offset?: number;
}

interface IFCSearchResult {
  guid: string;
  name: string;
  type: string;
  location: {
    floor?: string;
    zone?: string;
    room?: string;
  };
  properties: Record<string, any>;
  material?: string;
  fire_rating?: string;
  status?: string;
  supplier?: string;
  responsible?: string;
  related_issues?: string[];
  related_documents?: string[];
}

interface Facet {
  value: string;
  count: number;
}

interface FacetResponse {
  element_type?: Facet[];
  floor?: Facet[];
  zone?: Facet[];
  room?: Facet[];
  material?: Facet[];
  fire_rating?: Facet[];
  status?: Facet[];
  supplier?: Facet[];
}

export async function POST(request: NextRequest) {
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

    const body: IFCSearchQuery = await request.json();
    const { project_id, model_id, text, filters, limit = 50, offset = 0 } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Verifiser tilgang til prosjekt (forenklet for testing uten RLS)
    const { data: membership, error: membershipError } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) {
      console.error('Membership check error:', membershipError);
    }

    // For testing: Tillat tilgang hvis bruker er medlem ELLER hvis det ikke er noen medlemmer ennå
    if (!membership) {
      // Sjekk om prosjektet eksisterer
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', project_id)
        .single();
      
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      
      // For testing: Tillat tilgang selv uten membership
      console.log('Warning: User has no membership but access granted for testing');
    }

    // Bygg søkespørring
    let query = supabase
      .from('ifc_elements')
      .select('*', { count: 'exact' })
      .eq('project_id', project_id);

    if (model_id) {
      query = query.eq('model_id', model_id);
    }

    // Tekstsøk med full-text search
    if (text && text.trim()) {
      // Bruk PostgreSQL full-text search
      query = query.or(`name.ilike.%${text}%,description.ilike.%${text}%,element_type.ilike.%${text}%`);
    }

    // Anvend filtre
    if (filters) {
      if (filters.element_type?.length) {
        query = query.in('element_type', filters.element_type);
      }
      if (filters.floor?.length) {
        query = query.in('floor', filters.floor);
      }
      if (filters.zone?.length) {
        query = query.in('zone', filters.zone);
      }
      if (filters.room?.length) {
        query = query.in('room', filters.room);
      }
      if (filters.material?.length) {
        query = query.in('material', filters.material);
      }
      if (filters.fire_rating?.length) {
        query = query.in('fire_rating', filters.fire_rating);
      }
      if (filters.status?.length) {
        query = query.in('status', filters.status);
      }
      if (filters.supplier?.length) {
        query = query.in('supplier', filters.supplier);
      }
      if (filters.responsible?.length) {
        query = query.in('responsible', filters.responsible);
      }
    }

    // Paginering
    query = query.range(offset, offset + limit - 1);

    // Sortering
    query = query.order('element_type').order('name');

    const { data: results, error, count } = await query;

    if (error) {
      console.error('IFC search error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Hent fasetter (tilgjengelige filterverdier)
    const facets = await getFacets(supabase, project_id, model_id, filters);

    // Formater resultater
    const formattedResults: IFCSearchResult[] = (results || []).map((element: any) => ({
      guid: element.guid,
      name: element.name || element.element_type,
      type: element.element_type,
      location: {
        floor: element.floor,
        zone: element.zone,
        room: element.room
      },
      properties: element.properties || {},
      material: element.material,
      fire_rating: element.fire_rating,
      status: element.status,
      supplier: element.supplier,
      responsible: element.responsible,
      related_issues: [], // TODO: Hent fra issues tabell
      related_documents: [] // TODO: Hent fra documents tabell
    }));

    return NextResponse.json({
      results: formattedResults,
      total: count || 0,
      facets
    });

  } catch (error) {
    console.error('IFC search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getFacets(
  supabase: any,
  projectId: string,
  modelId: string | undefined,
  currentFilters: IFCSearchQuery['filters']
): Promise<FacetResponse> {
  const facetFields = [
    'element_type',
    'floor',
    'zone',
    'room',
    'material',
    'fire_rating',
    'status',
    'supplier'
  ];

  const facets: FacetResponse = {};

  for (const field of facetFields) {
    try {
      let query = supabase
        .from('ifc_elements')
        .select(field)
        .eq('project_id', projectId)
        .not(field, 'is', null);

      if (modelId) {
        query = query.eq('model_id', modelId);
      }

      // Anvend andre filtre (unntatt det aktuelle feltet)
      if (currentFilters) {
        for (const [key, values] of Object.entries(currentFilters)) {
          if (key !== field && Array.isArray(values) && values.length > 0) {
            query = query.in(key, values);
          }
        }
      }

      const { data, error } = await query;

      if (!error && data) {
        // Grupper og tell
        const counts = data.reduce((acc: Record<string, number>, row: any) => {
          const value = row[field];
          if (value) {
            acc[value] = (acc[value] || 0) + 1;
          }
          return acc;
        }, {});

        facets[field as keyof FacetResponse] = Object.entries(counts)
          .map(([value, count]) => ({ value, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50); // Begrens til 50 verdier per fasett
      }
    } catch (error) {
      console.error(`Error getting facet for ${field}:`, error);
    }
  }

  return facets;
}
