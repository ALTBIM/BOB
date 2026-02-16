'use client';

import { useState, useEffect } from 'react';
import { BCFTopic, BCFTopicFilters } from '@/types/bcf';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

interface BCFTopicListProps {
  projectId: string;
  onSelectTopic: (topic: BCFTopic) => void;
  selectedTopicId?: string;
  onCreateNew: () => void;
}

export function BCFTopicList({ 
  projectId, 
  onSelectTopic, 
  selectedTopicId,
  onCreateNew 
}: BCFTopicListProps) {
  const [topics, setTopics] = useState<BCFTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<BCFTopicFilters>({});

  useEffect(() => {
    fetchTopics();
  }, [projectId, searchQuery, filters]);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        project_id: projectId,
        ...(searchQuery && { search: searchQuery }),
        ...(filters.status && { status: filters.status.join(',') }),
        ...(filters.priority && { priority: filters.priority.join(',') }),
      });

      const response = await fetch(`/api/bcf/topics?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setTopics(data.topics || []);
      }
    } catch (error) {
      console.error('Failed to fetch BCF topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'kritisk': return 'bg-red-500';
      case 'høy': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'lav': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': return 'bg-purple-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

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
    <div className="flex flex-col h-full bg-white border-r">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">BCF Topics</h2>
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="w-4 h-4 mr-1" />
            Ny
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Søk topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter button */}
        <Button variant="outline" size="sm" className="w-full">
          <Filter className="w-4 h-4 mr-2" />
          Filtrer
        </Button>
      </div>

      {/* Topics list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Laster...</div>
        ) : topics.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            Ingen BCF topics funnet
          </div>
        ) : (
          <div className="divide-y">
            {topics.map((topic) => (
              <Card
                key={topic.id}
                className={`p-4 rounded-none border-0 border-l-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedTopicId === topic.id 
                    ? 'bg-blue-50 border-l-blue-500' 
                    : 'border-l-transparent'
                }`}
                onClick={() => onSelectTopic(topic)}
              >
                <div className="space-y-2">
                  {/* Title */}
                  <h3 className="font-medium text-sm line-clamp-2">
                    {topic.title}
                  </h3>

                  {/* Metadata row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant="secondary" 
                      className={`${getStatusColor(topic.status)} text-white text-xs`}
                    >
                      {getStatusLabel(topic.status)}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`${getPriorityColor(topic.priority)} text-white text-xs`}
                    >
                      {topic.priority}
                    </Badge>
                    {topic.discipline && (
                      <Badge variant="outline" className="text-xs">
                        {topic.discipline}
                      </Badge>
                    )}
                  </div>

                  {/* Labels */}
                  {topic.labels && topic.labels.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {topic.labels.slice(0, 3).map((label, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                      {topic.labels.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{topic.labels.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {formatDistanceToNow(new Date(topic.updated_at), {
                        addSuffix: true,
                        locale: nb,
                      })}
                    </span>
                    {topic.assigned_to && (
                      <span className="text-xs">👤 Tildelt</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
