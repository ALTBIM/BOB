"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Eye, Ruler, Package, MapPin } from "lucide-react";

interface CuttingListItem {
  id: string;
  positionNumber: string;
  description: string;
  material: string;
  dimensions: string;
  length: number;
  quantity: number;
  zone: string;
  drawingRef: string;
}

export default function CuttingListGenerator() {
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [generatedList, setGeneratedList] = useState<CuttingListItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [listName, setListName] = useState("");

  // Mock data for zones and materials
  const zones = [
    { id: "floor-1", name: "Ground Floor", objects: 1250 },
    { id: "floor-2", name: "Second Floor", objects: 1180 },
    { id: "floor-3", name: "Third Floor", objects: 1180 },
    { id: "basement", name: "Basement", objects: 850 },
    { id: "roof", name: "Roof Structure", objects: 420 }
  ];

  const materials = [
    { id: "timber-studs", name: "Timber Studs", category: "Structural", count: 450 },
    { id: "timber-beams", name: "Timber Beams", category: "Structural", count: 120 },
    { id: "plywood", name: "Plywood Sheets", category: "Panels", count: 280 },
    { id: "insulation", name: "Insulation Boards", category: "Insulation", count: 350 },
    { id: "drywall", name: "Drywall Panels", category: "Finishing", count: 420 },
    { id: "trim", name: "Trim & Molding", category: "Finishing", count: 180 }
  ];

  const handleMaterialToggle = (materialId: string) => {
    setSelectedMaterials(prev => 
      prev.includes(materialId) 
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const generateCuttingList = async () => {
    if (!selectedZone || selectedMaterials.length === 0) {
      alert("Please select a zone and at least one material type");
      return;
    }

    setIsGenerating(true);

    // Simulate API call to generate cutting list
    setTimeout(() => {
      const mockList: CuttingListItem[] = [
        {
          id: "1",
          positionNumber: "P001",
          description: "Vertical Stud 2x4",
          material: "Timber Studs",
          dimensions: "38x89mm",
          length: 2400,
          quantity: 24,
          zone: zones.find(z => z.id === selectedZone)?.name || "",
          drawingRef: "A-101"
        },
        {
          id: "2",
          positionNumber: "P002",
          description: "Horizontal Plate 2x4",
          material: "Timber Studs",
          dimensions: "38x89mm",
          length: 3600,
          quantity: 8,
          zone: zones.find(z => z.id === selectedZone)?.name || "",
          drawingRef: "A-101"
        },
        {
          id: "3",
          positionNumber: "P003",
          description: "Floor Joist 2x8",
          material: "Timber Beams",
          dimensions: "38x184mm",
          length: 4800,
          quantity: 16,
          zone: zones.find(z => z.id === selectedZone)?.name || "",
          drawingRef: "S-201"
        },
        {
          id: "4",
          positionNumber: "P004",
          description: "Plywood Subfloor 18mm",
          material: "Plywood Sheets",
          dimensions: "1220x2440x18mm",
          length: 2440,
          quantity: 12,
          zone: zones.find(z => z.id === selectedZone)?.name || "",
          drawingRef: "A-102"
        },
        {
          id: "5",
          positionNumber: "P005",
          description: "Wall Insulation Board",
          material: "Insulation Boards",
          dimensions: "600x1200x100mm",
          length: 1200,
          quantity: 28,
          zone: zones.find(z => z.id === selectedZone)?.name || "",
          drawingRef: "A-103"
        }
      ];

      setGeneratedList(mockList);
      setIsGenerating(false);
    }, 2000);
  };

  const exportList = (format: 'excel' | 'pdf' | 'csv') => {
    // Simulate export functionality
    alert(`Exporting cutting list as ${format.toUpperCase()}...`);
  };

  const viewDrawing = (drawingRef: string) => {
    // Simulate drawing viewer
    alert(`Opening drawing ${drawingRef} with position numbers...`);
  };

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Cutting List</CardTitle>
          <CardDescription>
            Select zones and materials to generate production-ready cutting lists with synchronized working drawings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zone Selection */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="list-name">List Name</Label>
                <Input
                  id="list-name"
                  placeholder="e.g., Ground Floor Framing"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                />
              </div>
              
              <div>
                <Label>Select Zone/Area</Label>
                <Select value={selectedZone} onValueChange={setSelectedZone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose zone or room" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{zone.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {zone.objects} objects
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Material Selection */}
            <div className="space-y-4">
              <Label>Select Materials</Label>
              <div className="space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3">
                {materials.map((material) => (
                  <div key={material.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={material.id}
                      checked={selectedMaterials.includes(material.id)}
                      onCheckedChange={() => handleMaterialToggle(material.id)}
                    />
                    <div className="flex-1">
                      <label htmlFor={material.id} className="text-sm font-medium cursor-pointer">
                        {material.name}
                      </label>
                      <div className="flex items-center space-x-2 text-xs text-slate-600">
                        <Badge variant="outline" className="text-xs">
                          {material.category}
                        </Badge>
                        <span>{material.count} items</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600">
              {selectedZone && selectedMaterials.length > 0 && (
                <span>
                  Ready to generate list for {zones.find(z => z.id === selectedZone)?.name} 
                  with {selectedMaterials.length} material type(s)
                </span>
              )}
            </div>
            <Button 
              onClick={generateCuttingList} 
              disabled={!selectedZone || selectedMaterials.length === 0 || isGenerating}
            >
              <FileText className="h-4 w-4 mr-2" />
              {isGenerating ? "Generating..." : "Generate Cutting List"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated List */}
      {generatedList.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>
                  {listName || "Cutting List"} - {zones.find(z => z.id === selectedZone)?.name}
                </CardTitle>
                <CardDescription>
                  Generated on {new Date().toLocaleDateString()} • {generatedList.length} items
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => exportList('excel')}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportList('pdf')}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportList('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pos.</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Length (mm)</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Drawing</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedList.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.positionNumber}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.material}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Ruler className="h-3 w-3 mr-1 text-slate-400" />
                          {item.dimensions}
                        </div>
                      </TableCell>
                      <TableCell>{item.length.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Package className="h-3 w-3 mr-1 text-slate-400" />
                          {item.quantity}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1 text-slate-400" />
                          {item.zone}
                        </div>
                      </TableCell>
                      <TableCell>{item.drawingRef}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => viewDrawing(item.drawingRef)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-2">Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Total Items:</span>
                  <div className="font-medium">{generatedList.length}</div>
                </div>
                <div>
                  <span className="text-slate-600">Total Quantity:</span>
                  <div className="font-medium">
                    {generatedList.reduce((sum, item) => sum + item.quantity, 0)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-600">Material Types:</span>
                  <div className="font-medium">{selectedMaterials.length}</div>
                </div>
                <div>
                  <span className="text-slate-600">Zone:</span>
                  <div className="font-medium">{zones.find(z => z.id === selectedZone)?.name}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}