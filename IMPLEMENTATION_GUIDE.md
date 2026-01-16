# BOB Platform - Implementeringsguide
**Komplett guide for utviklere**

---

## 📚 Innholdsfortegnelse

1. [Prosjektstruktur](#prosjektstruktur)
2. [Oppsett](#oppsett)
3. [Database-migrering](#database-migrering)
4. [API-implementering](#api-implementering)
5. [Frontend-komponenter](#frontend-komponenter)
6. [IFC-søk implementering](#ifc-søk-implementering)
7. [AI-integrasjon](#ai-integrasjon)
8. [Kappliste-generering](#kappliste-generering)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## 1. Prosjektstruktur

```
bob-platform/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── organizations/
│   │   │   ├── projects/
│   │   │   ├── issues/
│   │   │   ├── ifc/
│   │   │   │   ├── search/
│   │   │   │   └── elements/
│   │   │   ├── controls/
│   │   │   ├── cutlists/
│   │   │   ├── meetings/
│   │   │   └── ai/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── projects/
│   │       └── [id]/
│   │           ├── ifc/
│   │           ├── issues/
│   │           ├── controls/
│   │           └── cutlists/
│   ├── components/
│   │   ├── admin/
│   │   ├── ifc/
│   │   │   ├── IFCSearch.tsx
│   │   │   ├── IFCViewer.tsx
│   │   │   └── ElementCard.tsx
│   │   ├── issues/
│   │   ├── controls/
│   │   ├── cutlists/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── ifc/
│   │   │   ├── parser.ts
│   │   │   ├── search.ts
│   │   │   └── geometry.ts
│   │   ├── ai/
│   │   │   ├── context.ts
│   │   │   ├── chat.ts
│   │   │   └── rag.ts
│   │   ├── cutlist/
│   │   │   ├── generator.ts
│   │   │   └── export.ts
│   │   └── utils/
│   └── types/
│       ├── database.ts
│       ├── ifc.ts
│       └── api.ts
├── supabase/
│   ├── schema.sql
│   ├── migrations/
│   └── functions/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
```

---

## 2. Oppsett

### 2.1 Installer avhengigheter

```bash
npm install
```

### 2.2 Miljøvariabler

Opprett `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-key

# Vercel Blob (for fillagring)
BLOB_READ_WRITE_TOKEN=your-blob-token

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2.3 Kjør database-migrering

```bash
# Kjør eksisterende schema
psql -h your-db-host -U postgres -d postgres -f supabase/schema.sql

# Kjør nye migreringer
psql -h your-db-host -U postgres -d postgres -f DATABASE_MIGRATIONS.sql
```

---

## 3. Database-migrering

### 3.1 Verifiser migrering

```typescript
// src/lib/supabase/verify-migration.ts
import { createClient } from '@supabase/supabase-js';

export async function verifyMigration() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Sjekk at alle tabeller eksisterer
  const tables = [
    'ifc_elements',
    'issues',
    'issue_comments',
    'issue_history',
    'controls',
    'control_runs',
    'control_findings',
    'cutlist_items',
    'drawing_snippets',
    'activity_log',
    'notifications',
    'file_versions',
    'meetings',
    'meeting_packages'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.error(`❌ Tabell ${table} mangler eller har feil:`, error);
    } else {
      console.log(`✅ Tabell ${table} OK`);
    }
  }
}
```

---

## 4. API-implementering

### 4.1 IFC-søk API (KRITISK!)

```typescript
// src/app/api/ifc/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Verifiser autentisering
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { project_id, model_id, text, filters, limit = 50, offset = 0 } = body;

    // Verifiser tilgang til prosjekt
    const { data: access } = await supabase.rpc('can_project_read', {
      uid: user.id,
      pid: project_id
    });

    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Bygg søkespørring
    let query = supabase
      .from('ifc_elements')
      .select('*', { count: 'exact' })
      .eq('project_id', project_id);

    if (model_id) {
      query = query.eq('model_id', model_id);
    }

    // Tekstsøk
    if (text) {
      query = query.textSearch('name', text, {
        type: 'websearch',
        config: 'english'
      });
    }

    // Filtre
    if (filters?.element_type?.length) {
      query = query.in('element_type', filters.element_type);
    }
    if (filters?.floor?.length) {
      query = query.in('floor', filters.floor);
    }
    if (filters?.zone?.length) {
      query = query.in('zone', filters.zone);
    }
    if (filters?.room?.length) {
      query = query.in('room', filters.room);
    }
    if (filters?.material?.length) {
      query = query.in('material', filters.material);
    }
    if (filters?.fire_rating?.length) {
      query = query.in('fire_rating', filters.fire_rating);
    }
    if (filters?.status?.length) {
      query = query.in('status', filters.status);
    }
    if (filters?.supplier?.length) {
      query = query.in('supplier', filters.supplier);
    }

    // Paginering
    query = query.range(offset, offset + limit - 1);

    const { data: results, error, count } = await query;

    if (error) {
      console.error('IFC search error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Hent fasetter (tilgjengelige filterverdier)
    const facets = await getFacets(supabase, project_id, model_id, filters);

    return NextResponse.json({
      results,
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
  currentFilters: any
) {
  // Hent distinkte verdier for hver fasett
  const facetQueries = [
    'element_type',
    'floor',
    'zone',
    'room',
    'material',
    'fire_rating',
    'status',
    'supplier'
  ];

  const facets: Record<string, Array<{ value: string; count: number }>> = {};

  for (const facet of facetQueries) {
    let query = supabase
      .from('ifc_elements')
      .select(facet, { count: 'exact' })
      .eq('project_id', projectId);

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    // Anvend andre filtre (unntatt det aktuelle)
    if (currentFilters) {
      for (const [key, values] of Object.entries(currentFilters)) {
        if (key !== facet && Array.isArray(values) && values.length > 0) {
          query = query.in(key, values);
        }
      }
    }

    const { data, error } = await query;

    if (!error && data) {
      // Grupper og tell
      const counts = data.reduce((acc: any, row: any) => {
        const value = row[facet];
        if (value) {
          acc[value] = (acc[value] || 0) + 1;
        }
        return acc;
      }, {});

      facets[facet] = Object.entries(counts)
        .map(([value, count]) => ({ value, count: count as number }))
        .sort((a, b) => b.count - a.count);
    }
  }

  return facets;
}
```

### 4.2 Issues API

```typescript
// src/app/api/issues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity-logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { project_id, type, title, description, priority, category, assigned_to, due_date, ifc_element_guids, attachments } = body;

    // Verifiser write-tilgang
    const { data: canWrite } = await supabase.rpc('can_project_write', {
      uid: user.id,
      pid: project_id
    });

    if (!canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Opprett issue
    const { data: issue, error } = await supabase
      .from('issues')
      .insert({
        project_id,
        type,
        title,
        description,
        priority,
        category,
        assigned_to,
        due_date,
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
    await logActivity({
      userId: user.id,
      projectId: project_id,
      action: 'issue.created',
      entityType: 'issue',
      entityId: issue.id,
      details: { title, type, priority }
    });

    // Send varsel til tildelt person
    if (assigned_to) {
      await supabase
        .from('notifications')
        .insert({
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
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assigned_to');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Verifiser tilgang
    const { data: canRead } = await supabase.rpc('can_project_read', {
      uid: user.id,
      pid: projectId
    });

    if (!canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Bygg query
    let query = supabase
      .from('issues')
      .select('*, assigned_to_user:assigned_to(id, email)', { count: 'exact' })
      .eq('project_id', projectId);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    if (priority) query = query.eq('priority', priority);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);

    query = query.order('created_at', { ascending: false });

    const { data: issues, error, count } = await query;

    if (error) {
      console.error('Get issues error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Hent statistikk
    const { data: stats } = await supabase
      .from('issues')
      .select('status, priority')
      .eq('project_id', projectId);

    const byStatus = stats?.reduce((acc: any, issue: any) => {
      acc[issue.status] = (acc[issue.status] || 0) + 1;
      return acc;
    }, {});

    const byPriority = stats?.reduce((acc: any, issue: any) => {
      acc[issue.priority] = (acc[issue.priority] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      issues,
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
```

---

## 5. Frontend-komponenter

### 5.1 IFC Search Component (KRITISK!)

```typescript
// src/components/ifc/IFCSearch.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Search, Filter } from 'lucide-react';
import { debounce } from 'lodash';
import { ElementCard } from './ElementCard';

interface IFCSearchProps {
  projectId: string;
  modelId: string;
  onElementSelect: (guid: string) => void;
}

export function IFCSearch({ projectId, modelId, onElementSelect }: IFCSearchProps) {
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<any>({});
  const [results, setResults] = useState<any[]>([]);
  const [facets, setFacets] = useState<any>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Debounced search
  const performSearch = useCallback(
    debounce(async (text: string, currentFilters: any) => {
      setLoading(true);
      try {
        const response = await fetch('/api/ifc/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            model_id: modelId,
            text,
            filters: currentFilters,
            limit: 50,
            offset: 0
          })
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data.results);
          setFacets(data.facets);
          setTotal(data.total);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300),
    [projectId, modelId]
  );

  useEffect(() => {
    performSearch(searchText, filters);
  }, [searchText, filters, performSearch]);

  const handleFilterChange = (facet: string, value: string, checked: boolean) => {
    setFilters((prev: any) => {
      const current = prev[facet] || [];
      if (checked) {
        return { ...prev, [facet]: [...current, value] };
      } else {
        return { ...prev, [facet]: current.filter((v: string) => v !== value) };
      }
    });
  };

  return (
    <div className="flex h-full">
      {/* Venstre: Søk & Filtre */}
      <div className="w-80 border-r p-4 space-y-4 overflow-y-auto">
        {/* Søkefelt */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk i IFC-elementer..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filtre */}
        <Accordion type="multiple" className="w-full">
          {/* Elementtype */}
          <AccordionItem value="element_type">
            <AccordionTrigger>
              <div className="flex items-center justify-between w-full">
                <span>Elementtype</span>
                {filters.element_type?.length > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                    {filters.element_type.length}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {facets.element_type?.map((item: any) => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${item.value}`}
                      checked={filters.element_type?.includes(item.value)}
                      onCheckedChange={(checked) =>
                        handleFilterChange('element_type', item.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={`type-${item.value}`} className="flex-1 cursor-pointer">
                      {item.value}
                      <span className="text-muted-foreground ml-2">({item.count})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Etasje */}
          <AccordionItem value="floor">
            <AccordionTrigger>
              <div className="flex items-center justify-between w-full">
                <span>Etasje</span>
                {filters.floor?.length > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                    {filters.floor.length}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {facets.floor?.map((item: any) => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`floor-${item.value}`}
                      checked={filters.floor?.includes(item.value)}
                      onCheckedChange={(checked) =>
                        handleFilterChange('floor', item.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={`floor-${item.value}`} className="flex-1 cursor-pointer">
                      {item.value}
                      <span className="text-muted-foreground ml-2">({item.count})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Sone */}
          <AccordionItem value="zone">
            <AccordionTrigger>Sone</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {facets.zone?.map((item: any) => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`zone-${item.value}`}
                      checked={filters.zone?.includes(item.value)}
                      onCheckedChange={(checked) =>
                        handleFilterChange('zone', item.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={`zone-${item.value}`} className="flex-1 cursor-pointer">
                      {item.value}
                      <span className="text-muted-foreground ml-2">({item.count})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Materiale */}
          <AccordionItem value="material">
            <AccordionTrigger>Materiale</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {facets.material?.map((item: any) => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`material-${item.value}`}
                      checked={filters.material?.includes(item.value)}
                      onCheckedChange={(checked) =>
                        handleFilterChange('material', item.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={`material-${item.value}`} className="flex-1 cursor-pointer">
                      {item.value}
                      <span className="text-muted-foreground ml-2">({item.count})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Status */}
          <AccordionItem value="status">
            <AccordionTrigger>Status</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {facets.status?.map((item: any) => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${item.value}`}
                      checked={filters.status?.includes(item.value)}
                      onCheckedChange={(checked) =>
                        handleFilterChange('status', item.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={`status-${item.value}`} className="flex-1 cursor-pointer">
                      {item.value}
                      <span className="text-muted-foreground ml-2">({item.count})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Nullstill filtre */}
        {Object.keys(filters).some(key => filters[key]?.length > 0) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({})}
            className="w-full"
          >
            Nullstill filtre
          </Button>
        )}
      </div>

      {/* Høyre: Resultater */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Søker...' : `${total} resultater funnet`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Ingen resultater funnet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((element) => (
              <ElementCard
                key={element.guid}
                element={element}
                onClick={() => onElementSelect(element.guid)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5.2 Element Card Component

```typescript
// src/components/ifc/ElementCard.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertCircle, FileText } from 'lucide-react';

interface ElementCardProps {
  element: any;
  onClick: () => void;
}

export function ElementCard({ element, onClick }: ElementCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-green-500';
      case 'avvik': return 'bg-red-500';
      case 'til_kontroll': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card 
      className="cursor-pointer hover:bg-accent transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium">{element.name || element.type}</h4>
              <Badge variant="outline" className="text-xs">
                {element.type}
              </Badge>
              {element.status && (
                <div className={`w-2 h-2 rounded-full ${getStatusColor(element.status)}`} />
              )}
            </div>

            {element.location && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <MapPin className="h-3 w-3" />
                <span>
                  {[element.location.floor, element.location.zone, element.location.room]
                    .filter(Boolean)
                    .join(' / ')}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              {element.material && (
                <Badge variant="secondary">{element.material}</Badge>
              )}
              {element.fire_rating && (
                <Badge variant="secondary">{element.fire_rating}</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {element.related_issues?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span>{element.related_issues.length}</span>
              </div>
            )}
            {element.related_documents?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <FileText className="h-3 w-3" />
                <span>{element.related_documents.length}</span>
              </div>
            )}
          </div>
        </div>

        {element.properties && Object.keys(element.properties).length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(element.properties).slice(0, 4).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-fore
