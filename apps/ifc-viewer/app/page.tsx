"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Layers3, FileBox, Building2 } from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  // Demo data for quick testing
  const demoProjects = [
    {
      id: "demo-project-1",
      name: "Office Building Project",
      description: "Demo project with sample IFC model",
      modelId: "demo-model-1",
      modelName: "Building_A.ifc",
    },
    {
      id: "demo-project-2",
      name: "Residential Complex",
      description: "Multi-building residential project",
      modelId: "demo-model-2",
      modelName: "Residential_Block_B.ifc",
    },
  ]

  const handleOpenViewer = (projectId: string, modelId: string) => {
    router.push(`/projects/${projectId}/models/${modelId}/viewer`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="flex size-16 items-center justify-center rounded-xl bg-primary">
              <Layers3 className="size-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mb-3 text-balance text-4xl font-bold tracking-tight">BOB IFC Viewer</h1>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
            Professional Building Information Modeling viewer by ALTBIM with advanced filtering, collaboration tools,
            and BCF workflow support
          </p>
        </div>

        {/* Features Overview */}
        <div className="mb-12 grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Layers3 className="size-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Advanced Filtering</CardTitle>
              <CardDescription>
                Solibri-style nested filters with faceted search and dynamic rule builder
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent/10">
                <FileBox className="size-5 text-accent" />
              </div>
              <CardTitle className="text-lg">BCF Workflow</CardTitle>
              <CardDescription>
                Full BCF 2.1 support with issue tracking, markup tools, and collaboration
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-chart-2/20">
                <Building2 className="size-5 text-chart-2" />
              </div>
              <CardTitle className="text-lg">3D Visualization</CardTitle>
              <CardDescription>
                Interactive 3D viewer with spatial tree, property inspector, and saved views
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Demo Projects */}
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-2xl font-semibold">Demo Projects</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {demoProjects.map((project) => (
              <Card key={project.id} className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="size-5 text-primary" />
                    {project.name}
                  </CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <FileBox className="size-4" />
                    <span className="font-mono">{project.modelName}</span>
                  </div>
                  <Button onClick={() => handleOpenViewer(project.id, project.modelId)} className="w-full">
                    Open in Viewer
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Info */}
        <div className="mx-auto mt-12 max-w-3xl rounded-lg border bg-card p-6">
          <h3 className="mb-3 font-semibold">Getting Started</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">1.</span>
              Click on a demo project above to open the viewer
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">2.</span>
              Use the left sidebar to navigate the spatial tree and apply filters
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">3.</span>
              Click on elements in the 3D view to see properties in the right panel
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">4.</span>
              Try creating issues with markup tools and exporting as BCF
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
