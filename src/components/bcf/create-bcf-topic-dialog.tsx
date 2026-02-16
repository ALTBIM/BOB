'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateBCFTopicRequest } from '@/types/bcf';

interface CreateBCFTopicDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess?: (topicId: string) => void;
  prefillData?: {
    title?: string;
    description?: string;
    selectedElements?: string[];
    snapshotUrl?: string;
  };
}

export function CreateBCFTopicDialog({
  open,
  onClose,
  projectId,
  onSuccess,
  prefillData,
}: CreateBCFTopicDialogProps) {
  const [formData, setFormData] = useState<Partial<CreateBCFTopicRequest>>({
    title: prefillData?.title || '',
    description: prefillData?.description || '',
    status: 'open',
    priority: 'medium',
    ifc_element_guids: prefillData?.selectedElements || [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title?.trim()) {
      setError('Tittel er påkrevd');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateBCFTopicRequest = {
        project_id: projectId,
        title: formData.title,
        description: formData.description,
        status: formData.status || 'open',
        priority: formData.priority || 'medium',
        stage: formData.stage,
        discipline: formData.discipline,
        labels: formData.labels,
        assigned_to: formData.assigned_to,
        due_date: formData.due_date,
        ifc_element_guids: formData.ifc_element_guids,
      };

      // Add viewpoint if snapshot is available
      if (prefillData?.snapshotUrl) {
        payload.viewpoint = {
          snapshot_url: prefillData.snapshotUrl,
          selected_elements: prefillData.selectedElements,
        };
      }

      const response = await fetch('/api/bcf/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess?.(data.topic.id);
        handleClose();
      } else {
        setError(data.error || 'Kunne ikke opprette BCF topic');
      }
    } catch (err) {
      setError('En feil oppstod');
      console.error('Failed to create BCF topic:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
    });
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Opprett ny BCF Topic</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Tittel *</Label>
            <Input
              id="title"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Kort beskrivelse av problemet"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detaljert beskrivelse..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Åpen</SelectItem>
                  <SelectItem value="in_progress">Pågår</SelectItem>
                  <SelectItem value="resolved">Løst</SelectItem>
                  <SelectItem value="closed">Lukket</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioritet</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lav">Lav</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="høy">Høy</SelectItem>
                  <SelectItem value="kritisk">Kritisk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stage">Fase</Label>
              <Input
                id="stage"
                value={formData.stage || ''}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                placeholder="F.eks. Prosjektering"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discipline">Fag</Label>
              <Input
                id="discipline"
                value={formData.discipline || ''}
                onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                placeholder="F.eks. ARK, RIB, VVS"
              />
            </div>
          </div>

          {prefillData?.selectedElements && prefillData.selectedElements.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded">
              <p className="text-sm text-blue-700">
                {prefillData.selectedElements.length} IFC elementer valgt fra viewer
              </p>
            </div>
          )}

          {prefillData?.snapshotUrl && (
            <div className="space-y-2">
              <Label>Snapshot fra viewer</Label>
              <img
                src={prefillData.snapshotUrl}
                alt="Viewpoint snapshot"
                className="w-full h-48 object-cover rounded border"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Avbryt
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Oppretter...' : 'Opprett BCF Topic'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
