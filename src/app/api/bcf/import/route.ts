import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/supabase-auth';
import JSZip from 'jszip';

export const runtime = 'nodejs';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// POST /api/bcf/import - Import BCFZIP file
export async function POST(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase ikke konfigurert.' }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || 'Ikke autentisert.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('project_id') as string;
    const conflictResolution = (formData.get('conflict_resolution') as string) || 'skip';

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil lastet opp.' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'project_id er påkrevd.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fil er for stor. Maks størrelse er ${MAX_FILE_SIZE / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    // Verify project access
    const { data: canWrite } = await supabase.rpc('can_project_write', {
      p_user_id: user.id,
      p_project_id: projectId,
    });

    if (!canWrite) {
      return NextResponse.json(
        { error: 'Ingen tilgang til dette prosjektet.' },
        { status: 403 }
      );
    }

    // Read ZIP file
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Verify it's a valid BCF file
    const versionFile = zip.file('bcf.version');
    if (!versionFile) {
      return NextResponse.json(
        { error: 'Ugyldig BCF fil. bcf.version mangler.' },
        { status: 400 }
      );
    }

    const importResult = {
      success: true,
      imported_count: 0,
      updated_count: 0,
      skipped_count: 0,
      errors: [] as Array<{ topic_guid?: string; error: string }>,
    };

    // Get all topic folders
    const topicFolders = new Set<string>();
    zip.forEach((relativePath, file) => {
      const parts = relativePath.split('/');
      if (parts.length > 1 && !file.dir) {
        topicFolders.add(parts[0]);
      }
    });

    // Process each topic
    for (const topicGuid of topicFolders) {
      if (topicGuid === '') continue;

      try {
        const markupFile = zip.file(`${topicGuid}/markup.bcf`);
        if (!markupFile) {
          importResult.errors.push({
            topic_guid: topicGuid,
            error: 'markup.bcf mangler',
          });
          continue;
        }

        const markupXml = await markupFile.async('text');
        const topic = parseMarkupXML(markupXml, topicGuid);

        if (!topic) {
          importResult.errors.push({
            topic_guid: topicGuid,
            error: 'Kunne ikke parse markup.bcf',
          });
          continue;
        }

        // Check if topic already exists
        const { data: existingTopic } = await supabase
          .from('issues')
          .select('id')
          .eq('bcf_guid', topicGuid)
          .eq('project_id', projectId)
          .single();

        let topicId: string;

        if (existingTopic) {
          if (conflictResolution === 'skip') {
            importResult.skipped_count++;
            continue;
          } else if (conflictResolution === 'update') {
            // Update existing topic
            const { error } = await supabase
              .from('issues')
              .update({
                title: topic.title,
                description: topic.description,
                status: topic.status,
                priority: topic.priority,
                stage: topic.stage,
                discipline: topic.discipline,
                labels: topic.labels,
                assigned_to: topic.assigned_to,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingTopic.id);

            if (error) {
              importResult.errors.push({
                topic_guid: topicGuid,
                error: `Update failed: ${error.message}`,
              });
              continue;
            }

            topicId = existingTopic.id;
            importResult.updated_count++;
          } else {
            // duplicate - create with new GUID
            topicGuid = null; // Will generate new one
          }
        }

        if (!existingTopic || conflictResolution === 'duplicate') {
          // Create new topic
          const { data: newTopic, error } = await supabase.rpc('create_bcf_topic', {
            p_project_id: projectId,
            p_title: topic.title,
            p_description: topic.description,
            p_status: topic.status,
            p_priority: topic.priority,
            p_stage: topic.stage,
            p_discipline: topic.discipline,
            p_labels: topic.labels,
            p_assigned_to: topic.assigned_to,
            p_due_date: topic.due_date,
            p_ifc_element_guids: topic.ifc_element_guids || [],
          });

          if (error || !newTopic) {
            importResult.errors.push({
              topic_guid: topicGuid,
              error: `Create failed: ${error?.message || 'Unknown error'}`,
            });
            continue;
          }

          // Update with original BCF GUID if not duplicate
          if (conflictResolution !== 'duplicate') {
            await supabase
              .from('issues')
              .update({ bcf_guid: topicGuid })
              .eq('id', newTopic);
          }

          topicId = newTopic;
          importResult.imported_count++;
        }

        // Import comments
        if (topic.comments && topic.comments.length > 0) {
          for (const comment of topic.comments) {
            await supabase.from('issue_comments').insert({
              issue_id: topicId,
              user_id: user.id,
              comment: comment.text,
              created_at: comment.date || new Date().toISOString(),
            });
          }
        }

        // Import viewpoints
        if (topic.viewpoints && topic.viewpoints.length > 0) {
          for (const vp of topic.viewpoints) {
            const viewpointFile = zip.file(`${topicGuid}/${vp.viewpoint_file}`);
            if (!viewpointFile) continue;

            const viewpointXml = await viewpointFile.async('text');
            const viewpointData = parseViewpointXML(viewpointXml);

            // Get snapshot if available
            let snapshotData = null;
            if (vp.snapshot_file) {
              const snapshotFile = zip.file(`${topicGuid}/${vp.snapshot_file}`);
              if (snapshotFile) {
                const snapshotBuffer = await snapshotFile.async('base64');
                const ext = vp.snapshot_file.split('.').pop()?.toLowerCase();
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                snapshotData = `data:${mimeType};base64,${snapshotBuffer}`;
              }
            }

            await supabase.rpc('add_bcf_viewpoint', {
              p_issue_id: topicId,
              p_camera_position: viewpointData?.camera_position || null,
              p_camera_direction: viewpointData?.camera_direction || null,
              p_camera_up: viewpointData?.camera_up || null,
              p_snapshot_url: null,
              p_selected_elements: viewpointData?.selected_elements || [],
              p_visible_elements: viewpointData?.visible_elements || [],
              p_hidden_elements: viewpointData?.hidden_elements || [],
            });

            // Update with snapshot data if we have it
            if (snapshotData) {
              const { data: viewpoints } = await supabase
                .from('bcf_viewpoints')
                .select('id')
                .eq('issue_id', topicId)
                .order('created_at', { ascending: false })
                .limit(1);

              if (viewpoints && viewpoints.length > 0) {
                await supabase
                  .from('bcf_viewpoints')
                  .update({ snapshot_data: snapshotData })
                  .eq('id', viewpoints[0].id);
              }
            }
          }
        }

        // Log activity
        await supabase.from('activity_log').insert({
          user_id: user.id,
          project_id: projectId,
          action: 'bcf_topic_imported',
          entity_type: 'bcf_topic',
          entity_id: topicId,
          details: { bcf_guid: topicGuid, source: 'bcfzip_import' },
        });
      } catch (error) {
        importResult.errors.push({
          topic_guid: topicGuid,
          error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return NextResponse.json(importResult);
  } catch (error) {
    console.error('BCF import error:', error);
    return NextResponse.json(
      { error: 'Kunne ikke importere BCF fil.' },
      { status: 500 }
    );
  }
}

// Parse markup.bcf XML
function parseMarkupXML(xml: string, topicGuid: string): any {
  try {
    // Simple XML parsing - in production, use a proper XML parser like xml2js or fast-xml-parser
    const topic: any = {
      bcf_guid: topicGuid,
    };

    // Extract title
    const titleMatch = xml.match(/<Title>(.*?)<\/Title>/s);
    if (titleMatch) {
      topic.title = unescapeXml(titleMatch[1]);
    }

    // Extract description
    const descMatch = xml.match(/<Description>(.*?)<\/Description>/s);
    if (descMatch) {
      topic.description = unescapeXml(descMatch[1]);
    }

    // Extract status
    const statusMatch = xml.match(/TopicStatus="(.*?)"/);
    if (statusMatch) {
      const bcfStatus = statusMatch[1];
      topic.status = mapBCFStatusToInternal(bcfStatus);
    }

    // Extract priority
    const priorityMatch = xml.match(/<Priority>(.*?)<\/Priority>/);
    if (priorityMatch) {
      topic.priority = priorityMatch[1].toLowerCase();
    }

    // Extract stage
    const stageMatch = xml.match(/<Stage>(.*?)<\/Stage>/);
    if (stageMatch) {
      topic.stage = unescapeXml(stageMatch[1]);
    }

    // Extract labels
    const labelsMatch = xml.match(/<Labels>(.*?)<\/Labels>/);
    if (labelsMatch) {
      topic.labels = labelsMatch[1].split(' ').filter(Boolean);
    }

    // Extract assigned to
    const assignedMatch = xml.match(/<AssignedTo>(.*?)<\/AssignedTo>/);
    if (assignedMatch) {
      topic.assigned_to = assignedMatch[1];
    }

    // Extract comments
    topic.comments = [];
    const commentRegex = /<Comment[^>]*>(.*?)<\/Comment>/gs;
    let commentMatch;
    while ((commentMatch = commentRegex.exec(xml)) !== null) {
      const commentXml = commentMatch[1];
      const textMatch = commentXml.match(/<Comment>(.*?)<\/Comment>/s);
      const dateMatch = commentXml.match(/<Date>(.*?)<\/Date>/);

      if (textMatch) {
        topic.comments.push({
          text: unescapeXml(textMatch[1]),
          date: dateMatch ? dateMatch[1] : null,
        });
      }
    }

    // Extract viewpoints
    topic.viewpoints = [];
    const viewpointRegex = /<Viewpoints[^>]*>(.*?)<\/Viewpoints>/gs;
    let vpMatch;
    while ((vpMatch = viewpointRegex.exec(xml)) !== null) {
      const vpXml = vpMatch[1];
      const vpFileMatch = vpXml.match(/<Viewpoint>(.*?)<\/Viewpoint>/);
      const snapshotMatch = vpXml.match(/<Snapshot>(.*?)<\/Snapshot>/);

      if (vpFileMatch) {
        topic.viewpoints.push({
          viewpoint_file: vpFileMatch[1],
          snapshot_file: snapshotMatch ? snapshotMatch[1] : null,
        });
      }
    }

    return topic;
  } catch (error) {
    console.error('Error parsing markup XML:', error);
    return null;
  }
}

// Parse viewpoint.bcfv XML
function parseViewpointXML(xml: string): any {
  try {
    const viewpoint: any = {};

    // Extract camera position
    const camPosMatch = xml.match(/<CameraViewPoint>\s*<X>(.*?)<\/X>\s*<Y>(.*?)<\/Y>\s*<Z>(.*?)<\/Z>/s);
    if (camPosMatch) {
      viewpoint.camera_position = {
        x: parseFloat(camPosMatch[1]),
        y: parseFloat(camPosMatch[2]),
        z: parseFloat(camPosMatch[3]),
      };
    }

    // Extract camera direction
    const camDirMatch = xml.match(/<CameraDirection>\s*<X>(.*?)<\/X>\s*<Y>(.*?)<\/Y>\s*<Z>(.*?)<\/Z>/s);
    if (camDirMatch) {
      viewpoint.camera_direction = {
        x: parseFloat(camDirMatch[1]),
        y: parseFloat(camDirMatch[2]),
        z: parseFloat(camDirMatch[3]),
      };
    }

    // Extract camera up vector
    const camUpMatch = xml.match(/<CameraUpVector>\s*<X>(.*?)<\/X>\s*<Y>(.*?)<\/Y>\s*<Z>(.*?)<\/Z>/s);
    if (camUpMatch) {
      viewpoint.camera_up = {
        x: parseFloat(camUpMatch[1]),
        y: parseFloat(camUpMatch[2]),
        z: parseFloat(camUpMatch[3]),
      };
    }

    // Extract selected elements
    viewpoint.selected_elements = [];
    const selectionMatch = xml.match(/<Selection>(.*?)<\/Selection>/s);
    if (selectionMatch) {
      const guidRegex = /IfcGuid="([^"]+)"/g;
      let guidMatch;
      while ((guidMatch = guidRegex.exec(selectionMatch[1])) !== null) {
        viewpoint.selected_elements.push(guidMatch[1]);
      }
    }

    // Extract visible elements
    viewpoint.visible_elements = [];
    const visibilityMatch = xml.match(/<Visibility[^>]*>(.*?)<\/Visibility>/s);
    if (visibilityMatch) {
      const guidRegex = /IfcGuid="([^"]+)"/g;
      let guidMatch;
      while ((guidMatch = guidRegex.exec(visibilityMatch[1])) !== null) {
        viewpoint.visible_elements.push(guidMatch[1]);
      }
    }

    return viewpoint;
  } catch (error) {
    console.error('Error parsing viewpoint XML:', error);
    return null;
  }
}

// Map BCF status to internal status
function mapBCFStatusToInternal(bcfStatus: string): string {
  const statusMap: Record<string, string> = {
    'Open': 'open',
    'InProgress': 'in_progress',
    'Resolved': 'resolved',
    'Closed': 'closed',
  };
  return statusMap[bcfStatus] || 'open';
}

// Unescape XML entities
function unescapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
