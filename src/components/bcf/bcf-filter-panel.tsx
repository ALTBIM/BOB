'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { X, Filter, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface FilterPanelProps {
  onFiltersChange: (filters: any) => void;
  currentFilters: any;
}

export function BCFFilterPanel({ onFiltersChange, currentFilters }: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState(currentFilters);
  const [showPanel, setShowPanel] = useState(false);

  const statusOptions = [
    { value: 'open', label: 'Åpen' },
    { value: 'in_progress', label: 'Pågår' },
    { value: 'resolved', label: 'Løst' },
    { value: 'closed', label: 'Lukket' },
  ];

  const priorityOptions = [
    { value: 'kritisk', label: 'Kritisk' },
    { value: 'høy', label: 'Høy' },
    { value: 'medium', label: 'Medium' },
    { value: 'lav', label: 'Lav' },
  ];

  const stageOptions = [
    { value: 'Prosjektering', label: 'Prosjektering' },
    { value: 'Utførelse', label: 'Utførelse' },
    { value: 'Drift', label: 'Drift' },
  ];

  const disciplineOptions = [
    { value: 'ARK', label: 'ARK' },
    { value: 'RIB', label: 'RIB' },
    { value: 'VVS', label: 'VVS' },
    { value: 'EL', label: 'EL' },
  ];

  const presetFilters = {
    mine: {
      name: 'Mine saker',
      filters: { assigned_to_me: true },
    },
    unassigned: {
      name: 'Utildelte',
      filters: { unassigned: true },
    },
    high_priority: {
      name: 'Høy prioritet',
      filters: { priority: ['kritisk', 'høy'] },
    },
    open: {
      name: 'Åpne',
      filters: { status: ['open'] },
    },
    recent: {
      name: 'Sist oppdatert',
      filters: { sort_by: 'updated_at', sort_order: 'desc' },
    },
  };

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
  };

  const toggleArrayFilter = (key: string, value: string) => {
    const current = localFilters[key] || [];
    const newValue = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    updateFilter(key, newValue.length > 0 ? newValue : undefined);
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setShowPanel(false);
  };

  const clearFilters = () => {
    setLocalFilters({});
    onFiltersChange({});
  };

  const applyPreset = (presetKey: string) => {
    const preset = presetFilters[presetKey as keyof typeof presetFilters];
    setLocalFilters(preset.filters);
    onFiltersChange(preset.filters);
    setShowPanel(false);
  };

  const getActiveFilterCount = () => {
    return Object.keys(currentFilters).filter(key => 
      currentFilters[key] !== undefined && 
      currentFilters[key] !== null &&
      (Array.isArray(currentFilters[key]) ? currentFilters[key].length > 0 : true)
    ).length;
  };

  const activeCount = getActiveFilterCount();

  return (
    <div className="space-y-2">
      {/* Filter button with badge */}
      <Popover open={showPanel} onOpenChange={setShowPanel}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full relative">
            <Filter className="w-4 h-4 mr-2" />
            Filtrer
            {activeCount > 0 && (
              <Badge 
                variant="default" 
                className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filtrer BCF Topics</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPanel(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Presets */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Hurtigvalg</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(presetFilters).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(key)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Status</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={localFilters.status?.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayFilter('status', option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Prioritet</Label>
              <div className="flex flex-wrap gap-2">
                {priorityOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={localFilters.priority?.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayFilter('priority', option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Stage */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Fase</Label>
              <Select
                value={localFilters.stage || ''}
                onValueChange={(value) => updateFilter('stage', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Velg fase..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Alle faser</SelectItem>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Discipline */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Fag</Label>
              <Select
                value={localFilters.discipline || ''}
                onValueChange={(value) => updateFilter('discipline', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Velg fag..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Alle fag</SelectItem>
                  {disciplineOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Opprettet dato</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {localFilters.created_after 
                        ? format(new Date(localFilters.created_after), 'PP', { locale: nb })
                        : 'Fra'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={localFilters.created_after ? new Date(localFilters.created_after) : undefined}
                      onSelect={(date) => updateFilter('created_after', date?.toISOString())}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {localFilters.created_before 
                        ? format(new Date(localFilters.created_before), 'PP', { locale: nb })
                        : 'Til'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={localFilters.created_before ? new Date(localFilters.created_before) : undefined}
                      onSelect={(date) => updateFilter('created_before', date?.toISOString())}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Nullstill
              </Button>
              <Button onClick={applyFilters} className="flex-1">
                Bruk filtre
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {currentFilters.status?.map((status: string) => (
            <Badge key={status} variant="secondary" className="text-xs">
              Status: {statusOptions.find(s => s.value === status)?.label}
              <button
                onClick={() => {
                  const newFilters = {
                    ...currentFilters,
                    status: currentFilters.status.filter((s: string) => s !== status)
                  };
                  if (newFilters.status.length === 0) delete newFilters.status;
                  onFiltersChange(newFilters);
                }}
                className="ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {currentFilters.priority?.map((priority: string) => (
            <Badge key={priority} variant="secondary" className="text-xs">
              Prioritet: {priorityOptions.find(p => p.value === priority)?.label}
              <button
                onClick={() => {
                  const newFilters = {
                    ...currentFilters,
                    priority: currentFilters.priority.filter((p: string) => p !== priority)
                  };
                  if (newFilters.priority.length === 0) delete newFilters.priority;
                  onFiltersChange(newFilters);
                }}
                className="ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {currentFilters.stage && (
            <Badge variant="secondary" className="text-xs">
              Fase: {currentFilters.stage}
              <button
                onClick={() => {
                  const newFilters = { ...currentFilters };
                  delete newFilters.stage;
                  onFiltersChange(newFilters);
                }}
                className="ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {currentFilters.discipline && (
            <Badge variant="secondary" className="text-xs">
              Fag: {currentFilters.discipline}
              <button
                onClick={() => {
                  const newFilters = { ...currentFilters };
                  delete newFilters.discipline;
                  onFiltersChange(newFilters);
                }}
                className="ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
