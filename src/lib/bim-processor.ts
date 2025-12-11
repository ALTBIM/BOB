// BIM Data Processing Engine for BOB
// Handles IFC file processing, object extraction, and material quantification

export interface BIMObject {
  id: string;
  type: ObjectType;
  name: string;
  material: MaterialType;
  dimensions: Dimensions;
  zone: string;
  room?: string;
  floor: string;
  quantity: number;
  properties: Record<string, any>;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  volume: number;
  area: number;
  unit: 'mm' | 'cm' | 'm';
}

export interface CuttingListItem {
  id: string;
  positionNumber: string;
  description: string;
  material: MaterialType;
  dimensions: string;
  quantity: number;
  length: number;
  zone: string;
  room?: string;
  notes?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ProductionList {
  id: string;
  name: string;
  projectId: string;
  zones: string[];
  materials: MaterialType[];
  items: CuttingListItem[];
  totalItems: number;
  totalLength: number;
  generatedAt: string;
  generatedBy: string;
  status: 'draft' | 'approved' | 'in_production' | 'completed';
}

export type ObjectType = 
  | 'wall' | 'beam' | 'column' | 'slab' | 'door' | 'window' 
  | 'stair' | 'railing' | 'roof' | 'foundation' | 'pipe' | 'duct';

export type MaterialType = 
  | 'wood' | 'steel' | 'concrete' | 'aluminum' | 'glass' 
  | 'insulation' | 'drywall' | 'brick' | 'tile' | 'other';

export type ZoneType = 'room' | 'floor' | 'building' | 'area' | 'section';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  floor: string;
  area: number;
  objects: BIMObject[];
  parentZone?: string;
  childZones: string[];
}

class BIMProcessor {
  private static instance: BIMProcessor;
  
  // Mock BIM data for demonstration
  private mockObjects: BIMObject[] = [
    {
      id: 'obj-001',
      type: 'beam',
      name: 'Structural Beam SB-001',
      material: 'wood',
      dimensions: { length: 4800, width: 200, height: 300, volume: 0.288, area: 1.44, unit: 'mm' },
      zone: 'zone-a1',
      room: 'Living Room',
      floor: 'Floor 1',
      quantity: 8,
      properties: { grade: 'C24', treatment: 'Impregnated', supplier: 'Moelven' }
    },
    {
      id: 'obj-002',
      type: 'beam',
      name: 'Structural Beam SB-002',
      material: 'wood',
      dimensions: { length: 3600, width: 200, height: 300, volume: 0.216, area: 1.08, unit: 'mm' },
      zone: 'zone-a1',
      room: 'Kitchen',
      floor: 'Floor 1',
      quantity: 6,
      properties: { grade: 'C24', treatment: 'Impregnated', supplier: 'Moelven' }
    },
    {
      id: 'obj-003',
      type: 'column',
      name: 'Steel Column SC-001',
      material: 'steel',
      dimensions: { length: 2700, width: 150, height: 150, volume: 0.061, area: 0.405, unit: 'mm' },
      zone: 'zone-a2',
      room: 'Entrance Hall',
      floor: 'Floor 1',
      quantity: 4,
      properties: { grade: 'S355', coating: 'Hot-dip galvanized', supplier: 'Norsk Stål' }
    },
    {
      id: 'obj-004',
      type: 'wall',
      name: 'Interior Wall IW-001',
      material: 'drywall',
      dimensions: { length: 3000, width: 100, height: 2700, volume: 0.81, area: 8.1, unit: 'mm' },
      zone: 'zone-b1',
      room: 'Bedroom 1',
      floor: 'Floor 2',
      quantity: 12,
      properties: { thickness: '100mm', insulation: 'Mineral wool', supplier: 'Gyproc' }
    },
    {
      id: 'obj-005',
      type: 'beam',
      name: 'Floor Joist FJ-001',
      material: 'wood',
      dimensions: { length: 4200, width: 45, height: 195, volume: 0.037, area: 0.819, unit: 'mm' },
      zone: 'zone-b1',
      room: 'Bedroom 1',
      floor: 'Floor 2',
      quantity: 24,
      properties: { grade: 'C24', spacing: '600mm c/c', supplier: 'Moelven' }
    },
    {
      id: 'obj-006',
      type: 'slab',
      name: 'Concrete Slab CS-001',
      material: 'concrete',
      dimensions: { length: 6000, width: 4000, height: 200, volume: 4.8, area: 24, unit: 'mm' },
      zone: 'zone-a1',
      room: 'Living Room',
      floor: 'Floor 1',
      quantity: 1,
      properties: { grade: 'B35', reinforcement: 'B500NC', supplier: 'Norcem' }
    }
  ];

  private mockZones: Zone[] = [
    {
      id: 'zone-a1',
      name: 'Zone A1 - Living Area',
      type: 'area',
      floor: 'Floor 1',
      area: 45.5,
      objects: [],
      childZones: [],
      parentZone: 'floor-1'
    },
    {
      id: 'zone-a2', 
      name: 'Zone A2 - Entrance',
      type: 'area',
      floor: 'Floor 1',
      area: 12.3,
      objects: [],
      childZones: [],
      parentZone: 'floor-1'
    },
    {
      id: 'zone-b1',
      name: 'Zone B1 - Bedrooms',
      type: 'area', 
      floor: 'Floor 2',
      area: 38.7,
      objects: [],
      childZones: [],
      parentZone: 'floor-2'
    },
    {
      id: 'floor-1',
      name: 'Floor 1',
      type: 'floor',
      floor: 'Floor 1',
      area: 95.2,
      objects: [],
      childZones: ['zone-a1', 'zone-a2'],
      parentZone: 'building-1'
    },
    {
      id: 'floor-2',
      name: 'Floor 2', 
      type: 'floor',
      floor: 'Floor 2',
      area: 89.4,
      objects: [],
      childZones: ['zone-b1'],
      parentZone: 'building-1'
    }
  ];

  private constructor() {
    // Initialize zones with their objects
    this.initializeZones();
  }

  static getInstance(): BIMProcessor {
    if (!BIMProcessor.instance) {
      BIMProcessor.instance = new BIMProcessor();
    }
    return BIMProcessor.instance;
  }

  private initializeZones() {
    // Assign objects to zones
    this.mockZones.forEach(zone => {
      zone.objects = this.mockObjects.filter(obj => obj.zone === zone.id);
    });
  }

  // Get all available zones for a project
  getZones(projectId: string): Zone[] {
    // In real implementation, filter by projectId
    return [...this.mockZones];
  }

  // Get objects in specific zones
  getObjectsInZones(zoneIds: string[]): BIMObject[] {
    return this.mockObjects.filter(obj => zoneIds.includes(obj.zone));
  }

  // Get objects by material type
  getObjectsByMaterial(materials: MaterialType[]): BIMObject[] {
    return this.mockObjects.filter(obj => materials.includes(obj.material));
  }

  // Get objects by object type
  getObjectsByType(types: ObjectType[]): BIMObject[] {
    return this.mockObjects.filter(obj => types.includes(obj.type));
  }

  // Generate cutting list from selected criteria
  generateCuttingList(
    projectId: string,
    zones: string[],
    materials: MaterialType[],
    objectTypes?: ObjectType[]
  ): ProductionList {
    let objects = this.getObjectsInZones(zones);
    
    if (materials.length > 0) {
      objects = objects.filter(obj => materials.includes(obj.material));
    }
    
    if (objectTypes && objectTypes.length > 0) {
      objects = objects.filter(obj => objectTypes.includes(obj.type));
    }

    // Convert objects to cutting list items
    const items: CuttingListItem[] = [];
    let positionCounter = 1;

    objects.forEach(obj => {
      for (let i = 0; i < obj.quantity; i++) {
        const item: CuttingListItem = {
          id: `item-${obj.id}-${i + 1}`,
          positionNumber: `P${positionCounter.toString().padStart(3, '0')}`,
          description: `${obj.name} - ${obj.material.toUpperCase()}`,
          material: obj.material,
          dimensions: `${obj.dimensions.length}×${obj.dimensions.width}×${obj.dimensions.height}${obj.dimensions.unit}`,
          quantity: 1,
          length: obj.dimensions.length,
          zone: obj.zone,
          room: obj.room,
          notes: obj.properties.grade ? `Grade: ${obj.properties.grade}` : undefined,
          priority: this.determinePriority(obj)
        };
        items.push(item);
        positionCounter++;
      }
    });

    // Sort by zone, then by material, then by length
    items.sort((a, b) => {
      if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
      if (a.material !== b.material) return a.material.localeCompare(b.material);
      return b.length - a.length; // Longest first
    });

    const productionList: ProductionList = {
      id: `list-${Date.now()}`,
      name: `Cutting List - ${new Date().toLocaleDateString('no-NO')}`,
      projectId,
      zones,
      materials,
      items,
      totalItems: items.length,
      totalLength: items.reduce((sum, item) => sum + item.length, 0),
      generatedAt: new Date().toISOString(),
      generatedBy: 'Current User',
      status: 'draft'
    };

    return productionList;
  }

  private determinePriority(obj: BIMObject): 'high' | 'medium' | 'low' {
    // Structural elements get high priority
    if (['beam', 'column', 'foundation'].includes(obj.type)) {
      return 'high';
    }
    // Walls and slabs get medium priority
    if (['wall', 'slab'].includes(obj.type)) {
      return 'medium';
    }
    // Everything else gets low priority
    return 'low';
  }

  // Get material statistics
  getMaterialStatistics(objects: BIMObject[]): Record<MaterialType, { count: number; volume: number; area: number }> {
    const stats: Record<string, { count: number; volume: number; area: number }> = {};
    
    objects.forEach(obj => {
      if (!stats[obj.material]) {
        stats[obj.material] = { count: 0, volume: 0, area: 0 };
      }
      stats[obj.material].count += obj.quantity;
      stats[obj.material].volume += obj.dimensions.volume * obj.quantity;
      stats[obj.material].area += obj.dimensions.area * obj.quantity;
    });

    return stats as Record<MaterialType, { count: number; volume: number; area: number }>;
  }

  // Export cutting list to different formats
  exportCuttingList(list: ProductionList, format: 'csv' | 'excel' | 'pdf'): string {
    switch (format) {
      case 'csv':
        return this.exportToCSV(list);
      case 'excel':
        return this.exportToExcel(list);
      case 'pdf':
        return this.exportToPDF(list);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private exportToCSV(list: ProductionList): string {
    const headers = ['Position', 'Description', 'Material', 'Dimensions', 'Quantity', 'Length', 'Zone', 'Room', 'Notes'];
    const rows = list.items.map(item => [
      item.positionNumber,
      item.description,
      item.material,
      item.dimensions,
      item.quantity.toString(),
      item.length.toString(),
      item.zone,
      item.room || '',
      item.notes || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }

  private exportToExcel(list: ProductionList): string {
    // In a real implementation, you would use a library like xlsx
    // For now, return a mock Excel-like format
    return `Excel export for ${list.name} with ${list.totalItems} items`;
  }

  private exportToPDF(list: ProductionList): string {
    // In a real implementation, you would use a library like jsPDF
    // For now, return a mock PDF format
    return `PDF export for ${list.name} with ${list.totalItems} items`;
  }

  // Validate cutting list for common issues
  validateCuttingList(list: ProductionList): { isValid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for duplicate position numbers
    const positionNumbers = list.items.map(item => item.positionNumber);
    const duplicates = positionNumbers.filter((pos, index) => positionNumbers.indexOf(pos) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate position numbers found: ${duplicates.join(', ')}`);
    }

    // Check for very long pieces that might be difficult to handle
    const longPieces = list.items.filter(item => item.length > 6000);
    if (longPieces.length > 0) {
      warnings.push(`${longPieces.length} pieces longer than 6m may require special handling`);
    }

    // Check for mixed materials in same zone
    const zoneGroups = list.items.reduce((groups, item) => {
      if (!groups[item.zone]) groups[item.zone] = new Set();
      groups[item.zone].add(item.material);
      return groups;
    }, {} as Record<string, Set<string>>);

    Object.entries(zoneGroups).forEach(([zone, materials]) => {
      if (materials.size > 3) {
        warnings.push(`Zone ${zone} has many different materials (${materials.size}), consider splitting`);
      }
    });

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  }
}

// Export singleton instance
export const bimProcessor = BIMProcessor.getInstance();

// Helper functions
export const formatDimensions = (dimensions: Dimensions): string => {
  return `${dimensions.length}×${dimensions.width}×${dimensions.height}${dimensions.unit}`;
};

export const formatVolume = (volume: number, unit: string = 'm³'): string => {
  return `${volume.toFixed(3)} ${unit}`;
};

export const formatArea = (area: number, unit: string = 'm²'): string => {
  return `${area.toFixed(2)} ${unit}`;
};

export const getMaterialColor = (material: MaterialType): string => {
  const colors: Record<MaterialType, string> = {
    wood: '#8B4513',
    steel: '#708090',
    concrete: '#A9A9A9',
    aluminum: '#C0C0C0',
    glass: '#87CEEB',
    insulation: '#FFB6C1',
    drywall: '#F5F5DC',
    brick: '#B22222',
    tile: '#DDA0DD',
    other: '#696969'
  };
  return colors[material] || colors.other;
};