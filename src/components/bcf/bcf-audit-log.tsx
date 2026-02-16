'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { History, User, Calendar, Activity } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  user?: {
    email: string;
    name?: string;
  };
}

interface BCFAuditLogProps {
  topicId: string;
  projectId: string;
}

export function BCFAuditLog({ topicId, projectId }: BCFAuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
  }, [topicId]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/activity-log?entity_type=bcf_topic&entity_id=${topicId}&project_id=${projectId}`
      );
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('created')) return '✨';
    if (action.includes('updated') || action.includes('changed')) return '📝';
    if (action.includes('deleted')) return '🗑️';
    if (action.includes('comment')) return '💬';
    if (action.includes('status')) return '🏷️';
    if (action.includes('assigned')) return '👤';
    return '📋';
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'bcf_topic_created': 'Topic opprettet',
      'bcf_topic_updated': 'Topic oppdatert',
      'bcf_topic_deleted': 'Topic slettet',
      'bcf_comment_added': 'Kommentar lagt til',
      'bcf_status_changed': 'Status endret',
      'bcf_viewpoint_added': 'Viewpoint lagt til',
      'bcf_topic_assigned': 'Topic tildelt',
      'bcf_topic_imported': 'Topic importert',
      'bcf_topic_created_from_chat': 'Opprettet fra chat',
    };
    return labels[action] || action.replace(/_/g, ' ');
  };

  const getChangeDetails = (log: AuditLogEntry) => {
    const details = log.details || {};
    
    if (log.action === 'bcf_status_changed') {
      return `${details.old_status || 'N/A'} → ${details.new_status || 'N/A'}`;
    }
    
    if (log.action === 'bcf_topic_assigned') {
      return `Tildelt til: ${details.assigned_to || 'N/A'}`;
    }
    
    if (log.action === 'bcf_comment_added') {
      return details.comment_preview || 'Kommentar lagt til';
    }
    
    if (log.action === 'bcf_topic_updated') {
      const changes = [];
      if (details.title_changed) changes.push('tittel');
      if (details.description_changed) changes.push('beskrivelse');
      if (details.priority_changed) changes.push('prioritet');
      if (details.stage_changed) changes.push('fase');
      if (details.discipline_changed) changes.push('fag');
      return changes.length > 0 ? `Endret: ${changes.join(', ')}` : 'Oppdatert';
    }
    
    if (details.source === 'chat_conversion') {
      return 'Konvertert fra chat samtale';
    }
    
    if (details.source === 'bcfzip_import') {
      return 'Importert fra BCFZIP fil';
    }
    
    return null;
  };

  const displayLogs = showAll ? logs : logs.slice(0, 5);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">Laster aktivitetslogg...</div>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">
          <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Ingen aktivitet ennå</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-sm">Aktivitetslogg</h3>
            <Badge variant="secondary" className="text-xs">
              {logs.length}
            </Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="max-h-96">
        <div className="divide-y">
          {displayLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="text-2xl flex-shrink-0">
                  {getActionIcon(log.action)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {getActionLabel(log.action)}
                      </p>
                      {getChangeDetails(log) && (
                        <p className="text-xs text-gray-600 mt-1">
                          {getChangeDetails(log)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: nb,
                      })}
                    </span>
                  </div>

                  {/* User and timestamp */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.user?.name || log.user?.email || 'System'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(log.created_at), 'PPp', { locale: nb })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {logs.length > 5 && (
        <div className="border-t p-3 bg-gray-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full"
          >
            {showAll ? 'Vis mindre' : `Vis alle ${logs.length} hendelser`}
          </Button>
        </div>
      )}
    </Card>
  );
}
