'use client';

import { useState, useEffect } from 'react';
import { BCFTopic, BCFViewpoint, BCFComment, BCFTopicLink } from '@/types/bcf';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  User, 
  Tag, 
  MessageSquare, 
  Eye, 
  ExternalLink,
  Send 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

interface BCFTopicDetailProps {
  topicId: string;
  onUpdate?: () => void;
}

export function BCFTopicDetail({ topicId, onUpdate }: BCFTopicDetailProps) {
  const [topic, setTopic] = useState<BCFTopic | null>(null);
  const [viewpoints, setViewpoints] = useState<BCFViewpoint[]>([]);
  const [comments, setComments] = useState<BCFComment[]>([]);
  const [links, setLinks] = useState<BCFTopicLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (topicId) {
      fetchTopicDetails();
    }
  }, [topicId]);

  const fetchTopicDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/bcf/topics/${topicId}`);
      const data = await response.json();
      
      if (response.ok) {
        setTopic(data.topic);
        setViewpoints(data.viewpoints || []);
        setComments(data.comments || []);
        setLinks(data.links || []);
      }
    } catch (error) {
      console.error('Failed to fetch topic details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/bcf/topics/${topicId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment }),
      });

      if (response.ok) {
        setNewComment('');
        fetchTopicDetails();
        onUpdate?.();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/bcf/topics/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchTopicDetails();
        onUpdate?.();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const openInViewer = (viewpoint: BCFViewpoint) => {
    // This will be integrated with the IFC viewer
    console.log('Opening viewpoint in viewer:', viewpoint);
    window.location.href = `/app/viewer?viewpoint=${viewpoint.id}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Laster...</div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Velg en BCF topic</div>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Åpen';
      case 'in_progress': return 'Pågår';
      case 'resolved': return 'Løst';
      case 'closed': return 'Lukket';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{topic.title}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  #{topic.id.substring(0, 8)}
                </p>
              </div>
              <select
                value={topic.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm font-medium"
              >
                <option value="open">Åpen</option>
                <option value="in_progress">Pågår</option>
                <option value="resolved">Løst</option>
                <option value="closed">Lukket</option>
              </select>
            </div>

            {topic.description && (
              <p className="text-gray-700">{topic.description}</p>
            )}
          </div>

          <Separator />

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Prioritet:</span>
                <Badge variant="outline">{topic.priority}</Badge>
              </div>
              
              {topic.stage && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Fase:</span>
                  <Badge variant="secondary">{topic.stage}</Badge>
                </div>
              )}

              {topic.discipline && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Fag:</span>
                  <Badge variant="secondary">{topic.discipline}</Badge>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {topic.assigned_to && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Tildelt:</span>
                  <span>{topic.assigned_to}</span>
                </div>
              )}

              {topic.due_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Frist:</span>
                  <span>{new Date(topic.due_date).toLocaleDateString('nb-NO')}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Oppdatert:</span>
                <span>
                  {formatDistanceToNow(new Date(topic.updated_at), {
                    addSuffix: true,
                    locale: nb,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Labels */}
          {topic.labels && topic.labels.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-2">Tags</h3>
                <div className="flex gap-2 flex-wrap">
                  {topic.labels.map((label, idx) => (
                    <Badge key={idx} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Viewpoints */}
          {viewpoints.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3">Viewpoints</h3>
                <div className="grid grid-cols-2 gap-4">
                  {viewpoints.map((vp) => (
                    <Card key={vp.id} className="p-3 space-y-2">
                      {vp.snapshot_url && (
                        <img
                          src={vp.snapshot_url}
                          alt="Viewpoint snapshot"
                          className="w-full h-32 object-cover rounded"
                        />
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => openInViewer(vp)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Åpne i viewer
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Linked Elements */}
          {topic.ifc_element_guids && topic.ifc_element_guids.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-2">Koblede elementer</h3>
                <p className="text-sm text-gray-600">
                  {topic.ifc_element_guids.length} IFC elementer koblet
                </p>
              </div>
            </>
          )}

          {/* Comments */}
          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Kommentarer ({comments.length})
            </h3>
            
            <div className="space-y-4">
              {comments.map((comment) => (
                <Card key={comment.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {comment.user_email || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(comment.created_at), {
                            addSuffix: true,
                            locale: nb,
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.comment}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Add comment */}
      <div className="border-t p-4 space-y-2">
        <Textarea
          placeholder="Skriv en kommentar..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />
        <Button
          onClick={handleAddComment}
          disabled={submitting || !newComment.trim()}
          className="w-full"
        >
          <Send className="w-4 h-4 mr-2" />
          Send kommentar
        </Button>
      </div>
    </div>
  );
}
