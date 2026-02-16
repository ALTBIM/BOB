// BCF (BIM Collaboration Format) TypeScript Types
// Based on BCF 2.x specification

export type BCFStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type BCFPriority = 'lav' | 'medium' | 'høy' | 'kritisk';
export type BCFType = 'avvik' | 'rfi' | 'endringsforespørsel' | 'bcf';

export interface BCFTopic {
  id: string;
  project_id: string;
  bcf_guid?: string;
  type: BCFType;
  title: string;
  description?: string;
  status: BCFStatus;
  priority: BCFPriority;
  stage?: string;
  discipline?: string;
  category?: string;
  labels?: string[];
  assigned_to?: string;
  due_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  ifc_element_guids?: string[];
  attachments?: BCFAttachment[];
  metadata?: Record<string, any>;
}

export interface BCFViewpoint {
  id: string;
  issue_id: string;
  bcf_guid?: string;
  index: number;
  
  // Camera data
  camera_position?: { x: number; y: number; z: number };
  camera_direction?: { x: number; y: number; z: number };
  camera_up?: { x: number; y: number; z: number };
  field_of_view?: number;
  
  // Snapshot
  snapshot_type?: 'png' | 'jpg';
  snapshot_url?: string;
  snapshot_data?: string; // base64
  
  // Element selection
  selected_elements?: string[];
  visible_elements?: string[];
  hidden_elements?: string[];
  
  // Clipping planes
  clipping_planes?: BCFClippingPlane[];
  
  // Full viewpoint data
  viewpoint_data?: Record<string, any>;
  
  created_at: string;
  updated_at: string;
}

export interface BCFComment {
  id: string;
  issue_id: string;
  user_id?: string;
  comment: string;
  attachments?: BCFAttachment[];
  created_at: string;
  
  // Extended fields for display
  user_name?: string;
  user_email?: string;
}

export interface BCFAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface BCFClippingPlane {
  location: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
}

export interface BCFLabel {
  id: string;
  project_id: string;
  name: string;
  color?: string;
  created_at: string;
}

export interface BCFTopicLink {
  id: string;
  issue_id: string;
  link_type: 'ifc_element' | 'file' | 'chat_thread' | 'finding' | 'model';
  linked_entity_id?: string;
  linked_entity_guid?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// Request/Response types for API
export interface CreateBCFTopicRequest {
  project_id: string;
  title: string;
  description?: string;
  status?: BCFStatus;
  priority?: BCFPriority;
  stage?: string;
  discipline?: string;
  labels?: string[];
  assigned_to?: string;
  due_date?: string;
  ifc_element_guids?: string[];
  viewpoint?: CreateBCFViewpointRequest;
}

export interface CreateBCFViewpointRequest {
  camera_position?: { x: number; y: number; z: number };
  camera_direction?: { x: number; y: number; z: number };
  camera_up?: { x: number; y: number; z: number };
  field_of_view?: number;
  snapshot_url?: string;
  snapshot_data?: string;
  selected_elements?: string[];
  visible_elements?: string[];
  hidden_elements?: string[];
}

export interface UpdateBCFTopicRequest {
  title?: string;
  description?: string;
  status?: BCFStatus;
  priority?: BCFPriority;
  stage?: string;
  discipline?: string;
  labels?: string[];
  assigned_to?: string;
  due_date?: string;
}

export interface BCFTopicFilters {
  status?: BCFStatus[];
  priority?: BCFPriority[];
  assigned_to?: string[];
  labels?: string[];
  discipline?: string[];
  stage?: string[];
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
}

export interface BCFTopicListResponse {
  topics: BCFTopic[];
  total: number;
  page: number;
  per_page: number;
}

export interface BCFTopicDetailResponse {
  topic: BCFTopic;
  viewpoints: BCFViewpoint[];
  comments: BCFComment[];
  links: BCFTopicLink[];
}

// BCF ZIP export/import types
export interface BCFExportOptions {
  topic_ids?: string[];
  include_all?: boolean;
  project_id: string;
}

export interface BCFImportOptions {
  project_id: string;
  conflict_resolution?: 'update' | 'duplicate' | 'skip';
  link_to_model_id?: string;
}

export interface BCFImportResult {
  success: boolean;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  errors: Array<{
    topic_guid?: string;
    error: string;
  }>;
}

// Viewer integration types
export interface BCFViewerAPI {
  openTopic(topicId: string): Promise<void>;
  openViewpoint(viewpointId: string): Promise<void>;
  createTopicFromSelection(data: {
    title: string;
    description?: string;
    selectedElements: string[];
  }): Promise<string>;
  captureSnapshot(): Promise<string>; // returns base64
  getCameraState(): {
    position: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
  };
}
