'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BCFTopic } from '@/types/bcf';
import { BCFTopicList } from '@/components/bcf/bcf-topic-list';
import { BCFTopicDetail } from '@/components/bcf/bcf-topic-detail';
import { CreateBCFTopicDialog } from '@/components/bcf/create-bcf-topic-dialog';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';

export default function BCFPage() {
  const searchParams = useSearchParams();
  const [projectId, setProjectId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    // Get project ID from URL or localStorage
    const urlProjectId = searchParams.get('project_id');
    const storedProjectId = localStorage.getItem('selected_project_id');
    
    if (urlProjectId) {
      setProjectId(urlProjectId);
      localStorage.setItem('selected_project_id', urlProjectId);
    } else if (storedProjectId) {
      setProjectId(storedProjectId);
    } else {
      // Redirect to project selection if no project is selected
      window.location.href = '/app/dashboard';
    }
  }, [searchParams]);

  const handleSelectTopic = (topic: BCFTopic) => {
    setSelectedTopicId(topic.id);
  };

  const handleCreateSuccess = (topicId: string) => {
    setSelectedTopicId(topicId);
  };

  const handleExport = async () => {
    if (!projectId) return;
    
    try {
      const response = await fetch('/api/bcf/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          include_all: true,
        }),
      });

      if (response.ok) {
        // Download the ZIP file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bcf-export-${Date.now()}.bcfzip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Export failed:', await response.text());
        alert('Kunne ikke eksportere BCF topics');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('En feil oppstod under eksport');
    }
  };

  const handleImport = () => {
    // TODO: Implement BCF import
    console.log('Import BCF topics');
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Laster...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">BCF Topics</h1>
            <p className="text-sm text-gray-500">
              Administrer BCF (BIM Collaboration Format) topics
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleImport}>
              <Upload className="w-4 h-4 mr-2" />
              Importer BCFZIP
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Eksporter BCFZIP
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Topic list */}
        <div className="w-96 border-r bg-white">
          <BCFTopicList
            projectId={projectId}
            onSelectTopic={handleSelectTopic}
            selectedTopicId={selectedTopicId || undefined}
            onCreateNew={() => setShowCreateDialog(true)}
          />
        </div>

        {/* Right panel - Topic detail */}
        <div className="flex-1 overflow-hidden">
          {selectedTopicId ? (
            <BCFTopicDetail
              topicId={selectedTopicId}
              onUpdate={() => {
                // Refresh the list
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">Velg en BCF topic fra listen</p>
                <p className="text-sm">eller opprett en ny</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <CreateBCFTopicDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        projectId={projectId}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
