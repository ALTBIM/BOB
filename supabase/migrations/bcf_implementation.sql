-- ============================================================================
-- BCF (BIM Collaboration Format) Implementation
-- Extends existing issues system with BCF 2.x compatibility
-- ============================================================================

-- Extend issues table with BCF-specific fields
ALTER TABLE public.issues 
  ADD COLUMN IF NOT EXISTS bcf_guid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS discipline TEXT,
  ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';

-- Add BCF-specific type
ALTER TABLE public.issues 
  DROP CONSTRAINT IF EXISTS issues_type_check;
ALTER TABLE public.issues 
  ADD CONSTRAINT issues_type_check 
  CHECK (type IN ('avvik', 'rfi', 'endringsforespørsel', 'bcf'));

-- Add BCF-compatible status (open, in_progress, resolved, closed)
ALTER TABLE public.issues 
  DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE public.issues 
  ADD CONSTRAINT issues_status_check 
  CHECK (status IN ('ny', 'under_behandling', 'avklart', 'lukket', 'open', 'in_progress', 'resolved', 'closed'));

-- Create index for BCF GUID lookups
CREATE INDEX IF NOT EXISTS idx_issues_bcf_guid ON public.issues(bcf_guid) WHERE bcf_guid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_issues_labels ON public.issues USING GIN(labels);
CREATE INDEX IF NOT EXISTS idx_issues_stage ON public.issues(stage);
CREATE INDEX IF NOT EXISTS idx_issues_discipline ON public.issues(discipline);

-- ============================================================================
-- BCF VIEWPOINTS (Camera positions and element selections)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bcf_viewpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  bcf_guid TEXT UNIQUE,
  index INTEGER DEFAULT 0,
  
  -- Camera/Perspective data
  camera_position JSONB, -- {x, y, z}
  camera_direction JSONB, -- {x, y, z}
  camera_up JSONB, -- {x, y, z}
  field_of_view DOUBLE PRECISION,
  
  -- Snapshot
  snapshot_type TEXT, -- 'png' or 'jpg'
  snapshot_url TEXT,
  snapshot_data TEXT, -- base64 encoded if stored inline
  
  -- Element selection
  selected_elements TEXT[] DEFAULT '{}', -- IFC GUIDs
  visible_elements TEXT[] DEFAULT '{}', -- IFC GUIDs
  hidden_elements TEXT[] DEFAULT '{}', -- IFC GUIDs
  
  -- Clipping planes (optional, P2)
  clipping_planes JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  viewpoint_data JSONB DEFAULT '{}'::jsonb, -- Full BCF viewpoint XML as JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcf_viewpoints_issue ON public.bcf_viewpoints(issue_id);
CREATE INDEX IF NOT EXISTS idx_bcf_viewpoints_bcf_guid ON public.bcf_viewpoints(bcf_guid) WHERE bcf_guid IS NOT NULL;

-- RLS for viewpoints
ALTER TABLE public.bcf_viewpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bcf_viewpoints_select" ON public.bcf_viewpoints;
CREATE POLICY "bcf_viewpoints_select" ON public.bcf_viewpoints FOR SELECT
USING (
  public.can_project_read(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = bcf_viewpoints.issue_id)
  )
);

DROP POLICY IF EXISTS "bcf_viewpoints_insert" ON public.bcf_viewpoints;
CREATE POLICY "bcf_viewpoints_insert" ON public.bcf_viewpoints FOR INSERT
WITH CHECK (
  public.can_project_write(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = bcf_viewpoints.issue_id)
  )
);

DROP POLICY IF EXISTS "bcf_viewpoints_update" ON public.bcf_viewpoints;
CREATE POLICY "bcf_viewpoints_update" ON public.bcf_viewpoints FOR UPDATE
USING (
  public.can_project_write(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = bcf_viewpoints.issue_id)
  )
);

DROP POLICY IF EXISTS "bcf_viewpoints_delete" ON public.bcf_viewpoints;
CREATE POLICY "bcf_viewpoints_delete" ON public.bcf_viewpoints FOR DELETE
USING (
  public.can_project_write(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = bcf_viewpoints.issue_id)
  )
);

-- ============================================================================
-- BCF LABELS (Tags/Categories)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bcf_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_bcf_labels_project ON public.bcf_labels(project_id);

-- RLS for labels
ALTER TABLE public.bcf_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bcf_labels_select" ON public.bcf_labels;
CREATE POLICY "bcf_labels_select" ON public.bcf_labels FOR SELECT
USING (public.can_project_read(auth.uid(), bcf_labels.project_id));

DROP POLICY IF EXISTS "bcf_labels_insert" ON public.bcf_labels;
CREATE POLICY "bcf_labels_insert" ON public.bcf_labels FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), bcf_labels.project_id));

DROP POLICY IF EXISTS "bcf_labels_update" ON public.bcf_labels;
CREATE POLICY "bcf_labels_update" ON public.bcf_labels FOR UPDATE
USING (public.can_project_write(auth.uid(), bcf_labels.project_id));

DROP POLICY IF EXISTS "bcf_labels_delete" ON public.bcf_labels;
CREATE POLICY "bcf_labels_delete" ON public.bcf_labels FOR DELETE
USING (public.can_project_admin(auth.uid(), bcf_labels.project_id));

-- ============================================================================
-- BCF TOPIC LINKS (Links to IFC elements, files, chat threads)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bcf_topic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('ifc_element', 'file', 'chat_thread', 'finding', 'model')),
  linked_entity_id UUID, -- UUID of linked entity
  linked_entity_guid TEXT, -- For IFC elements (GUID)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcf_topic_links_issue ON public.bcf_topic_links(issue_id);
CREATE INDEX IF NOT EXISTS idx_bcf_topic_links_type ON public.bcf_topic_links(link_type);
CREATE INDEX IF NOT EXISTS idx_bcf_topic_links_entity ON public.bcf_topic_links(linked_entity_id);

-- RLS for topic links
ALTER TABLE public.bcf_topic_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bcf_topic_links_select" ON public.bcf_topic_links;
CREATE POLICY "bcf_topic_links_select" ON public.bcf_topic_links FOR SELECT
USING (
  public.can_project_read(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = bcf_topic_links.issue_id)
  )
);

DROP POLICY IF EXISTS "bcf_topic_links_insert" ON public.bcf_topic_links;
CREATE POLICY "bcf_topic_links_insert" ON public.bcf_topic_links FOR INSERT
WITH CHECK (
  public.can_project_write(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = bcf_topic_links.issue_id)
  )
);

DROP POLICY IF EXISTS "bcf_topic_links_delete" ON public.bcf_topic_links;
CREATE POLICY "bcf_topic_links_delete" ON public.bcf_topic_links FOR DELETE
USING (
  public.can_project_write(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = bcf_topic_links.issue_id)
  )
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create BCF topic from issue
CREATE OR REPLACE FUNCTION public.create_bcf_topic(
  p_project_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'open',
  p_priority TEXT DEFAULT 'medium',
  p_stage TEXT DEFAULT NULL,
  p_discipline TEXT DEFAULT NULL,
  p_labels TEXT[] DEFAULT '{}',
  p_assigned_to UUID DEFAULT NULL,
  p_due_date TIMESTAMPTZ DEFAULT NULL,
  p_ifc_element_guids TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_issue_id UUID;
  v_bcf_guid TEXT;
BEGIN
  -- Generate BCF GUID
  v_bcf_guid := gen_random_uuid()::TEXT;
  
  -- Create issue
  INSERT INTO public.issues (
    project_id,
    type,
    title,
    description,
    status,
    priority,
    stage,
    discipline,
    labels,
    assigned_to,
    due_date,
    ifc_element_guids,
    bcf_guid,
    created_by
  ) VALUES (
    p_project_id,
    'bcf',
    p_title,
    p_description,
    p_status,
    p_priority,
    p_stage,
    p_discipline,
    p_labels,
    p_assigned_to,
    p_due_date,
    p_ifc_element_guids,
    v_bcf_guid,
    auth.uid()
  )
  RETURNING id INTO v_issue_id;
  
  RETURN v_issue_id;
END;
$$;

-- Function to add viewpoint to BCF topic
CREATE OR REPLACE FUNCTION public.add_bcf_viewpoint(
  p_issue_id UUID,
  p_camera_position JSONB DEFAULT NULL,
  p_camera_direction JSONB DEFAULT NULL,
  p_camera_up JSONB DEFAULT NULL,
  p_snapshot_url TEXT DEFAULT NULL,
  p_selected_elements TEXT[] DEFAULT '{}',
  p_visible_elements TEXT[] DEFAULT '{}',
  p_hidden_elements TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_viewpoint_id UUID;
  v_bcf_guid TEXT;
  v_index INTEGER;
BEGIN
  -- Generate BCF GUID
  v_bcf_guid := gen_random_uuid()::TEXT;
  
  -- Get next index
  SELECT COALESCE(MAX(index), -1) + 1 
  INTO v_index
  FROM public.bcf_viewpoints 
  WHERE issue_id = p_issue_id;
  
  -- Create viewpoint
  INSERT INTO public.bcf_viewpoints (
    issue_id,
    bcf_guid,
    index,
    camera_position,
    camera_direction,
    camera_up,
    snapshot_url,
    selected_elements,
    visible_elements,
    hidden_elements
  ) VALUES (
    p_issue_id,
    v_bcf_guid,
    v_index,
    p_camera_position,
    p_camera_direction,
    p_camera_up,
    p_snapshot_url,
    p_selected_elements,
    p_visible_elements,
    p_hidden_elements
  )
  RETURNING id INTO v_viewpoint_id;
  
  RETURN v_viewpoint_id;
END;
$$;

-- Trigger to create system comment when status changes
CREATE OR REPLACE FUNCTION public.bcf_status_change_comment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.issue_comments (
      issue_id,
      user_id,
      comment
    ) VALUES (
      NEW.id,
      auth.uid(),
      format('Status changed from "%s" to "%s"', OLD.status, NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bcf_status_change ON public.issues;
CREATE TRIGGER trigger_bcf_status_change
  AFTER UPDATE ON public.issues
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.bcf_status_change_comment();

-- ============================================================================
-- COMMENTS
-- End of BCF schema migration
-- ============================================================================
