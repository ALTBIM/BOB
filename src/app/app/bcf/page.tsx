'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BCFTopic } from '@/types/bcf';
import { BCFTopicList } from '@/components/bcf/bcf-topic-list';
import { BCFTopicDetail } from '@/components/bcf/bcf-topic-detail';
import { CreateBCFTopicDialog } from '@/components/bcf/create-bcf-topic-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, Upload } from 'lucide-react';

export default function BCFPage() {
  const searchParams = useSearchParams();
  const [projectId, setProjectId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);

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
    setShowImportDialog(true);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectId) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_id', projectId);
      formData.append('conflict_resolution', 'skip'); // Default to skip conflicts

      const response = await fetch('/api/bcf/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Import vellykket!\n\nImportert: ${result.imported_count}\nOppdatert: ${result.updated_count}\nHoppet over: ${result.skipped_count}\n${result.errors.length > 0 ? `\nFeil: ${result.errors.length}` : ''}`);
        setShowImportDialog(false);
        // Refresh the list
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Import feilet: ${error.error}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('En feil oppstod under import');
    } finally {
      setImporting(false);
    }
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

      {/* Import dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer BCFZIP</DialogTitle>
            <DialogDescription>
              Last opp en BCF fil (.bcfzip) for å importere topics til dette prosjektet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="bcf-file" className="block text-sm font-medium mb-2">
                Velg BCFZIP fil
              </label>
              <input
                id="bcf-file"
                type="file"
                accept=".bcfzip,.zip"
                onChange={handleImportFile}
                disabled={importing}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            {importing && (
              <div className="text-sm text-gray-500">
                Importerer... Dette kan ta litt tid.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
