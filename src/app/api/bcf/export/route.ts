import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';
import JSZip from 'jszip';

export const runtime = 'nodejs';

// POST /api/bcf/export - Export BCF topics to BCFZIP format
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
  const { project_id, topic_ids, include_all } = body;

  if (!project_id) {
    return NextResponse.json({ error: 'project_id er påkrevd.' }, { status: 400 });
  }

  try {
    // Build query for topics
    let query = supabase
      .from('issues')
      .select('*, viewpoints:bcf_viewpoints(*), comments:issue_comments(*, user:auth.users(email))')
      .eq('project_id', project_id)
      .eq('type', 'bcf');

    // Filter by specific topic IDs if provided
    if (!include_all && topic_ids && topic_ids.length > 0) {
      query = query.in('id', topic_ids);
    }

    const { data: topics, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: 'Ingen topics funnet.' }, { status: 404 });
    }

    // Create ZIP file
    const zip = new JSZip();

    // Add bcf.version file
    zip.file('bcf.version', `<?xml version="1.0" encoding="UTF-8"?>
<Version VersionId="2.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="version.xsd">
  <DetailedVersion>2.1</DetailedVersion>
</Version>`);

    // Add project.bcfp file (optional but recommended)
    zip.file('project.bcfp', `<?xml version="1.0" encoding="UTF-8"?>
<ProjectExtension xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="project.xsd">
  <Project ProjectId="${project_id}">
    <Name>BCF Export from BOB</Name>
  </Project>
</ProjectExtension>`);

    // Process each topic
    for (const topic of topics) {
      const topicGuid = topic.bcf_guid || topic.id;
      const topicFolder = zip.folder(topicGuid);

      if (!topicFolder) continue;

      // Create markup.bcf file
      const markup = generateMarkupXML(topic);
      topicFolder.file('markup.bcf', markup);

      // Add viewpoint files
      if (topic.viewpoints && topic.viewpoints.length > 0) {
        for (const viewpoint of topic.viewpoints) {
          const vpGuid = viewpoint.bcf_guid || viewpoint.id;
          
          // Create viewpoint.bcfv file
          const viewpointXml = generateViewpointXML(viewpoint);
          topicFolder.file(`${vpGuid}.bcfv`, viewpointXml);

          // Add snapshot if available
          if (viewpoint.snapshot_data) {
            // Extract base64 data and determine extension
            const base64Match = viewpoint.snapshot_data.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
            if (base64Match) {
              const extension = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
              const base64Data = base64Match[2];
              topicFolder.file(`${vpGuid}.${extension}`, base64Data, { base64: true });
            }
          } else if (viewpoint.snapshot_url) {
            // Note: For external URLs, we'd need to fetch them, which is more complex
            // For now, we'll just reference them in the viewpoint XML
          }
        }
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="bcf-export-${Date.now()}.bcfzip"`,
      },
    });
  } catch (error) {
    console.error('Failed to export BCF:', error);
    return NextResponse.json(
      { error: 'Kunne ikke eksportere BCF topics.' },
      { status: 500 }
    );
  }
}

// Helper function to generate markup XML
function generateMarkupXML(topic: any): string {
  const topicGuid = topic.bcf_guid || topic.id;
  const creationDate = new Date(topic.created_at).toISOString();
  const modifiedDate = new Date(topic.updated_at).toISOString();

  // Map BOB statuses to BCF statuses
  const statusMap: Record<string, string> = {
    'open': 'Open',
    'in_progress': 'InProgress',
    'resolved': 'Resolved',
    'closed': 'Closed',
  };

  const bcfStatus = statusMap[topic.status] || 'Open';

  // Start building XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="markup.xsd">
  <Header>
    <File IfcProject="" IfcSpatialStructureElement="" isExternal="false">
      <Filename></Filename>
      <Date>${creationDate}</Date>
      <Reference></Reference>
    </File>
  </Header>
  <Topic Guid="${topicGuid}" TopicType="" TopicStatus="${bcfStatus}">
    <ReferenceLink></ReferenceLink>
    <Title>${escapeXml(topic.title)}</Title>
    <Priority>${topic.priority || ''}</Priority>
    <Index>0</Index>
    <Labels>${(topic.labels || []).join(' ')}</Labels>
    <CreationDate>${creationDate}</CreationDate>
    <CreationAuthor>${topic.created_by || ''}</CreationAuthor>
    <ModifiedDate>${modifiedDate}</ModifiedDate>
    <ModifiedAuthor>${user?.id || ''}</ModifiedAuthor>
    ${topic.assigned_to ? `<AssignedTo>${topic.assigned_to}</AssignedTo>` : ''}
    ${topic.stage ? `<Stage>${escapeXml(topic.stage)}</Stage>` : ''}
    ${topic.description ? `<Description>${escapeXml(topic.description)}</Description>` : ''}
    ${topic.discipline ? `<BimSnippet><SnippetType>Discipline</SnippetType><Reference>${escapeXml(topic.discipline)}</Reference></BimSnippet>` : ''}
  </Topic>`;

  // Add comments
  if (topic.comments && topic.comments.length > 0) {
    for (const comment of topic.comments) {
      const commentDate = new Date(comment.created_at).toISOString();
      const commentGuid = comment.id;
      const author = comment.user?.email || 'Unknown';

      xml += `
  <Comment Guid="${commentGuid}">
    <Date>${commentDate}</Date>
    <Author>${escapeXml(author)}</Author>
    <Comment>${escapeXml(comment.comment)}</Comment>
    <Viewpoint Guid=""></Viewpoint>
    <ModifiedDate>${commentDate}</ModifiedDate>
    <ModifiedAuthor>${escapeXml(author)}</ModifiedAuthor>
  </Comment>`;
    }
  }

  // Add viewpoints
  if (topic.viewpoints && topic.viewpoints.length > 0) {
    for (const viewpoint of topic.viewpoints) {
      const vpGuid = viewpoint.bcf_guid || viewpoint.id;
      const vpFile = `${vpGuid}.bcfv`;
      const snapshotExt = viewpoint.snapshot_type || 'png';
      const snapshotFile = viewpoint.snapshot_data || viewpoint.snapshot_url ? `${vpGuid}.${snapshotExt}` : '';

      xml += `
  <Viewpoints Guid="${vpGuid}">
    <Viewpoint>${vpFile}</Viewpoint>
    ${snapshotFile ? `<Snapshot>${snapshotFile}</Snapshot>` : ''}
    <Index>${viewpoint.index || 0}</Index>
  </Viewpoints>`;
    }
  }

  xml += '\n</Markup>';
  return xml;
}

// Helper function to generate viewpoint XML
function generateViewpointXML(viewpoint: any): string {
  const vpGuid = viewpoint.bcf_guid || viewpoint.id;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<VisualizationInfo Guid="${vpGuid}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="visinfo.xsd">`;

  // Add components (selected/visible/hidden elements)
  if (viewpoint.selected_elements?.length > 0 || viewpoint.visible_elements?.length > 0 || viewpoint.hidden_elements?.length > 0) {
    xml += '\n  <Components>';

    if (viewpoint.selected_elements?.length > 0) {
      xml += '\n    <Selection>';
      for (const guid of viewpoint.selected_elements) {
        xml += `\n      <Component IfcGuid="${escapeXml(guid)}" />`;
      }
      xml += '\n    </Selection>';
    }

    if (viewpoint.visible_elements?.length > 0) {
      xml += '\n    <Visibility DefaultVisibility="false">';
      for (const guid of viewpoint.visible_elements) {
        xml += `\n      <Component IfcGuid="${escapeXml(guid)}" />`;
      }
      xml += '\n    </Visibility>';
    }

    xml += '\n  </Components>';
  }

  // Add perspective camera
  if (viewpoint.camera_position && viewpoint.camera_direction && viewpoint.camera_up) {
    xml += `
  <PerspectiveCamera>
    <CameraViewPoint>
      <X>${viewpoint.camera_position.x}</X>
      <Y>${viewpoint.camera_position.y}</Y>
      <Z>${viewpoint.camera_position.z}</Z>
    </CameraViewPoint>
    <CameraDirection>
      <X>${viewpoint.camera_direction.x}</X>
      <Y>${viewpoint.camera_direction.y}</Y>
      <Z>${viewpoint.camera_direction.z}</Z>
    </CameraDirection>
    <CameraUpVector>
      <X>${viewpoint.camera_up.x}</X>
      <Y>${viewpoint.camera_up.y}</Y>
      <Z>${viewpoint.camera_up.z}</Z>
    </CameraUpVector>
    <FieldOfView>${viewpoint.field_of_view || 60}</FieldOfView>
  </PerspectiveCamera>`;
  }

  xml += '\n</VisualizationInfo>';
  return xml;
}

// Helper function to escape XML special characters
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
