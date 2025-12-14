"use client"

import type React from "react"

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react"
import type { ViewerColorMode } from "@/lib/types/viewer"
import type { Viewpoint } from "@/lib/types/viewpoint"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { IFCModel } from "@/lib/ifc/ifc-loader"
import { useViewerStore } from "@/lib/store/viewer-store"
import { Button } from "@/components/ui/button"
import { UploadIcon } from "@/components/icons/upload-icon"
import { IFCModelLoader } from "@/lib/ifc/ifc-loader"

export interface ViewerCanvasRef {
  highlight: (ids: string[]) => void
  select: (ids: string[]) => void
  isolate: (ids: string[]) => void
  hide: (ids: string[]) => void
  show: (ids: string[]) => void
  showAll: () => void
  fitTo: (ids?: string[]) => void
  setColorMode: (mode: ViewerColorMode) => void
  setNonResultsOpacity: (alpha: number) => void
  setSectionBox: (enabled: boolean) => void
  setClippingPlanes: (enabled: boolean) => void
  getCamera: () => Viewpoint["camera"]
  setCamera: (camera: Viewpoint["camera"]) => void
  getClippingState: () => Viewpoint["clipping"]
  setClippingState: (clipping: Viewpoint["clipping"]) => void
  captureSnapshot: () => Promise<string>
  applyViewpoint: (viewpoint: Viewpoint) => void
  getModel: () => IFCModel | null
}

const ViewerCanvas = forwardRef<ViewerCanvasRef>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const ifcModelRef = useRef<IFCModel | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null)
  const selectedMeshesRef = useRef<Set<THREE.Mesh>>(new Set())

  const [isLoading, setIsLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ifcLoaderRef = useRef<IFCModelLoader | null>(null)

  const { setSelectedIds, setSelectedProperties } = useViewerStore()

  useImperativeHandle(ref, () => ({
    highlight: (ids: string[]) => {
      if (!ifcModelRef.current) return
      ids.forEach((id) => {
        const element = ifcModelRef.current!.elements.get(Number.parseInt(id))
        if (element?.mesh) {
          const mat = element.mesh.material as THREE.MeshStandardMaterial
          mat.emissive.setHex(0x3b82f6)
          mat.emissiveIntensity = 0.3
        }
      })
    },
    select: (ids: string[]) => {
      if (!ifcModelRef.current) return
      selectedMeshesRef.current.clear()
      ifcModelRef.current.elements.forEach((el) => {
        const mat = el.mesh.material as THREE.MeshStandardMaterial
        mat.emissive.setHex(0x000000)
        mat.emissiveIntensity = 0
      })
      ids.forEach((id) => {
        const element = ifcModelRef.current!.elements.get(Number.parseInt(id))
        if (element?.mesh) {
          const mat = element.mesh.material as THREE.MeshStandardMaterial
          mat.emissive.setHex(0x10b981)
          mat.emissiveIntensity = 0.5
          selectedMeshesRef.current.add(element.mesh)
        }
      })
    },
    isolate: (ids: string[]) => {
      if (!ifcModelRef.current) return
      ifcModelRef.current.elements.forEach((el, elId) => {
        el.mesh.visible = ids.includes(elId.toString())
      })
    },
    hide: (ids: string[]) => {
      if (!ifcModelRef.current) return
      ids.forEach((id) => {
        const element = ifcModelRef.current!.elements.get(Number.parseInt(id))
        if (element?.mesh) {
          element.mesh.visible = false
        }
      })
    },
    show: (ids: string[]) => {
      if (!ifcModelRef.current) return
      ids.forEach((id) => {
        const element = ifcModelRef.current!.elements.get(Number.parseInt(id))
        if (element?.mesh) {
          element.mesh.visible = true
        }
      })
    },
    showAll: () => {
      if (!ifcModelRef.current) return
      ifcModelRef.current.elements.forEach((el) => {
        el.mesh.visible = true
      })
    },
    fitTo: (ids?: string[]) => {
      if (!controlsRef.current || !cameraRef.current || !ifcModelRef.current) return

      const box = new THREE.Box3().setFromObject(ifcModelRef.current.mesh)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())

      const maxDim = Math.max(size.x, size.y, size.z)
      const fov = cameraRef.current.fov * (Math.PI / 180)
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
      cameraZ *= 1.5

      cameraRef.current.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ)
      controlsRef.current.target.copy(center)
      controlsRef.current.update()
    },
    setColorMode: (mode: ViewerColorMode) => {
      console.log("[v0] Set color mode:", mode)
    },
    setNonResultsOpacity: (alpha: number) => {
      if (!ifcModelRef.current) return
      ifcModelRef.current.elements.forEach((el) => {
        const mat = el.mesh.material as THREE.MeshStandardMaterial
        mat.transparent = alpha < 1
        mat.opacity = alpha
      })
    },
    setSectionBox: (enabled: boolean) => {
      console.log("[v0] Set section box:", enabled)
    },
    setClippingPlanes: (enabled: boolean) => {
      console.log("[v0] Set clipping planes:", enabled)
    },
    getCamera: () => {
      if (!cameraRef.current) return { position: [0, 0, 0], target: [0, 0, 0], up: [0, 0, 1], fov: 45 }
      const cam = cameraRef.current
      const target = controlsRef.current?.target || new THREE.Vector3()
      return {
        position: [cam.position.x, cam.position.y, cam.position.z],
        target: [target.x, target.y, target.z],
        up: [cam.up.x, cam.up.y, cam.up.z],
        fov: cam.fov,
      }
    },
    setCamera: (camera) => {
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(...camera.position)
        controlsRef.current.target.set(...camera.target)
        cameraRef.current.up.set(...camera.up)
        cameraRef.current.fov = camera.fov
        cameraRef.current.updateProjectionMatrix()
        controlsRef.current.update()
      }
    },
    getClippingState: () => {
      return {
        planes: { enabled: false },
        sectionBox: { enabled: false, min: [0, 0, 0], max: [10, 10, 10] },
      }
    },
    setClippingState: (clipping) => {
      console.log("[v0] Set clipping state:", clipping)
    },
    captureSnapshot: async () => {
      if (rendererRef.current) {
        return rendererRef.current.domElement.toDataURL("image/png")
      }
      return "/placeholder.svg?height=400&width=600"
    },
    applyViewpoint: (viewpoint: Viewpoint) => {
      if (viewpoint.camera && cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(...viewpoint.camera.position)
        controlsRef.current.target.set(...viewpoint.camera.target)
        cameraRef.current.up.set(...viewpoint.camera.up)
        cameraRef.current.fov = viewpoint.camera.fov
        cameraRef.current.updateProjectionMatrix()
        controlsRef.current.update()
      }
    },
    getModel: () => ifcModelRef.current,
  }))

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f1419)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      2000,
    )
    camera.position.set(50, 50, 50)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(50, 100, 50)
    directionalLight.castShadow = true
    directionalLight.shadow.camera.left = -100
    directionalLight.shadow.camera.right = 100
    directionalLight.shadow.camera.top = 100
    directionalLight.shadow.camera.bottom = -100
    scene.add(directionalLight)

    const gridHelper = new THREE.GridHelper(200, 50, 0x444444, 0x2a3142)
    scene.add(gridHelper)

    const initLoader = async () => {
      const loader = new IFCModelLoader((progress) => setUploadProgress(progress))
      await loader.init()
      ifcLoaderRef.current = loader
    }
    initLoader()

    const createDemoBuilding = () => {
      const group = new THREE.Group()
      const elements = new Map()
      let expressID = 1

      const createBox = (width: number, height: number, depth: number, color: number): THREE.Mesh => {
        const geometry = new THREE.BoxGeometry(width, height, depth)
        const material = new THREE.MeshStandardMaterial({ color })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        return mesh
      }

      const foundation = createBox(20, 1, 15, 0x808080)
      foundation.position.set(0, -0.5, 0)
      foundation.userData.expressID = expressID
      elements.set(expressID++, {
        expressID: expressID - 1,
        globalId: `foundation-${Math.random().toString(36).substr(2, 9)}`,
        type: "IFCFOOTING",
        name: "Foundation",
        properties: {
          Material: "Concrete",
          Height: "1m",
          LoadBearing: "Yes",
          Volume: "300 m³",
          Area: "300 m²",
          Perimeter: "70 m",
        },
        mesh: foundation,
      })
      group.add(foundation)

      const wallPositions = [
        { x: 0, z: 7.5, width: 20, height: 6, depth: 0.3, name: "North Wall" },
        { x: 0, z: -7.5, width: 20, height: 6, depth: 0.3, name: "South Wall" },
        { x: 10, z: 0, width: 0.3, height: 6, depth: 15, name: "East Wall" },
        { x: -10, z: 0, width: 0.3, height: 6, depth: 15, name: "West Wall" },
      ]

      wallPositions.forEach((pos) => {
        const wall = createBox(pos.width, pos.height, pos.depth, 0xcccccc)
        wall.position.set(pos.x, pos.height / 2, pos.z)
        wall.userData.expressID = expressID
        const volume = (pos.width * pos.height * pos.depth).toFixed(2)
        const area = (pos.width * pos.height).toFixed(2)
        elements.set(expressID++, {
          expressID: expressID - 1,
          globalId: `wall-${Math.random().toString(36).substr(2, 9)}`,
          type: "IFCWALL",
          name: pos.name,
          properties: {
            Material: "Concrete",
            Thickness: "0.3m",
            FireRating: "120min",
            Volume: `${volume} m³`,
            Area: `${area} m²`,
            Height: `${pos.height} m`,
          },
          mesh: wall,
        })
        group.add(wall)
      })

      const floor = createBox(19.4, 0.2, 14.4, 0xd4a574)
      floor.position.set(0, 0.1, 0)
      floor.userData.expressID = expressID
      elements.set(expressID++, {
        expressID: expressID - 1,
        globalId: `floor-${Math.random().toString(36).substr(2, 9)}`,
        type: "IFCSLAB",
        name: "Ground Floor",
        properties: {
          Material: "Wood",
          Thickness: "0.2m",
          LoadBearing: "No",
          Area: "279.36 m²",
          Volume: "55.87 m³",
          Perimeter: "67.6 m",
        },
        mesh: floor,
      })
      group.add(floor)

      const windowPositions = [
        { x: -5, y: 3, z: 7.6, name: "North Window 1" },
        { x: 5, y: 3, z: 7.6, name: "North Window 2" },
        { x: -5, y: 3, z: -7.6, name: "South Window 1" },
        { x: 5, y: 3, z: -7.6, name: "South Window 2" },
      ]

      windowPositions.forEach((pos) => {
        const window = createBox(2, 2, 0.1, 0x87ceeb)
        window.position.set(pos.x, pos.y, pos.z)
        window.userData.expressID = expressID
        const volume = (pos.width * pos.height * pos.depth).toFixed(2)
        const area = (pos.width * pos.height).toFixed(2)
        elements.set(expressID++, {
          expressID: expressID - 1,
          globalId: `window-${Math.random().toString(36).substr(2, 9)}`,
          type: "IFCWINDOW",
          name: pos.name,
          properties: {
            Material: "Glass",
            Width: "2m",
            Height: "2m",
            UValue: "1.2",
            Area: `${area} m²`,
            "Glazing Type": "Double Glazed",
          },
          mesh: window,
        })
        group.add(window)
      })

      const columnPositions = [
        { x: 7, z: 5, name: "Column NE" },
        { x: -7, z: 5, name: "Column NW" },
        { x: 7, z: -5, name: "Column SE" },
        { x: -7, z: -5, name: "Column SW" },
      ]

      columnPositions.forEach((pos) => {
        const column = createBox(0.5, 6, 0.5, 0x696969)
        column.position.set(pos.x, 3, pos.z)
        column.userData.expressID = expressID
        elements.set(expressID++, {
          expressID: expressID - 1,
          globalId: `column-${Math.random().toString(36).substr(2, 9)}`,
          type: "IFCCOLUMN",
          name: pos.name,
          properties: {
            Material: "Steel",
            Section: "HEB300",
            LoadBearing: "Yes",
            Height: "6 m",
            "Cross Section Area": "0.25 m²",
            Weight: "1125 kg",
          },
          mesh: column,
        })
        group.add(column)
      })

      const roof = createBox(20, 0.3, 15, 0x8b4513)
      roof.position.set(0, 6.15, 0)
      roof.userData.expressID = expressID
      elements.set(expressID++, {
        expressID: expressID - 1,
        globalId: `roof-${Math.random().toString(36).substr(2, 9)}`,
        type: "IFCROOF",
        name: "Roof",
        properties: {
          Material: "Timber",
          Thickness: "0.3m",
          Insulation: "R-30",
          Area: "300 m²",
          Volume: "90 m³",
          Pitch: "0 degrees",
        },
        mesh: roof,
      })
      group.add(roof)

      const spatialStructure = [
        {
          expressID: 0,
          name: "Demo Building",
          type: "IFCBUILDING",
          children: [
            {
              expressID: 1,
              name: "Ground Floor",
              type: "IFCBUILDINGSTOREY",
              children: [],
            },
          ],
        },
      ]

      return {
        modelID: 1,
        mesh: group,
        elements,
        spatialStructure,
      }
    }

    const model = createDemoBuilding()
    ifcModelRef.current = model
    scene.add(model.mesh)

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !ifcModelRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)

      const meshes: THREE.Mesh[] = []
      ifcModelRef.current.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child)
        }
      })

      const intersects = raycasterRef.current.intersectObjects(meshes, false)

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh
        const expressID = clickedMesh.userData.expressID

        if (expressID !== undefined) {
          const element = ifcModelRef.current.elements.get(expressID)
          if (element) {
            selectedMeshesRef.current.forEach((mesh) => {
              const mat = mesh.material as THREE.MeshStandardMaterial
              mat.emissive.setHex(0x000000)
              mat.emissiveIntensity = 0
            })
            selectedMeshesRef.current.clear()

            const mat = clickedMesh.material as THREE.MeshStandardMaterial
            mat.emissive.setHex(0x10b981)
            mat.emissiveIntensity = 0.5
            selectedMeshesRef.current.add(clickedMesh)

            setSelectedIds([expressID.toString()])
            setSelectedProperties([
              {
                expressID: element.expressID,
                globalId: element.globalId,
                type: element.type,
                name: element.name,
                properties: element.properties,
              },
            ])
          }
        }
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !ifcModelRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)

      const meshes: THREE.Mesh[] = []
      ifcModelRef.current.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child)
        }
      })

      const intersects = raycasterRef.current.intersectObjects(meshes, false)

      if (hoveredMeshRef.current && hoveredMeshRef.current !== intersects[0]?.object) {
        if (!selectedMeshesRef.current.has(hoveredMeshRef.current)) {
          const mat = hoveredMeshRef.current.material as THREE.MeshStandardMaterial
          mat.emissive.setHex(0x000000)
          mat.emissiveIntensity = 0
        }
        hoveredMeshRef.current = null
        containerRef.current.style.cursor = "default"
      }

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object as THREE.Mesh
        if (hoveredMesh !== hoveredMeshRef.current && !selectedMeshesRef.current.has(hoveredMesh)) {
          const mat = hoveredMesh.material as THREE.MeshStandardMaterial
          mat.emissive.setHex(0x3b82f6)
          mat.emissiveIntensity = 0.2
          hoveredMeshRef.current = hoveredMesh
          containerRef.current.style.cursor = "pointer"
        }
      }
    }

    containerRef.current.addEventListener("click", handleClick)
    containerRef.current.addEventListener("mousemove", handleMouseMove)

    const box = new THREE.Box3().setFromObject(model.mesh)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
    cameraZ *= 1.5
    camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ)
    controls.target.copy(center)
    controls.update()

    setIsLoading(false)

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return
      cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (containerRef.current) {
        containerRef.current.removeEventListener("click", handleClick)
        containerRef.current.removeEventListener("mousemove", handleMouseMove)
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
      if (ifcLoaderRef.current) {
        ifcLoaderRef.current.dispose()
      }
      if (containerRef.current && containerRef.current.contains(rendererRef.current?.domElement)) {
        containerRef.current.removeChild(rendererRef.current!.domElement)
      }
    }
  }, [setSelectedIds, setSelectedProperties])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !ifcLoaderRef.current || !sceneRef.current) return

    console.log("[v0] Starting file upload process...")
    setIsUploading(true)
    setUploadProgress(0)

    try {
      if (ifcModelRef.current) {
        console.log("[v0] Removing previous model...")
        sceneRef.current.remove(ifcModelRef.current.mesh)
      }

      console.log("[v0] Loading IFC file...")
      const model = await ifcLoaderRef.current.loadFromFile(file)
      console.log("[v0] IFC model loaded, adding to scene...")

      ifcModelRef.current = model
      sceneRef.current.add(model.mesh)

      console.log("[v0] Mapping element IDs to meshes...")
      let meshCount = 0
      model.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // web-ifc-three uses expressID property on meshes
          const expressID = (child as any).expressID
          if (expressID !== undefined) {
            child.userData.expressID = expressID
            const element = model.elements.get(expressID)
            if (element) {
              element.mesh = child
            }
            meshCount++
          }
        }
      })
      console.log("[v0] Mapped", meshCount, "meshes")

      if (cameraRef.current && controlsRef.current) {
        console.log("[v0] Fitting camera to model...")
        const box = new THREE.Box3().setFromObject(model.mesh)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = cameraRef.current.fov * (Math.PI / 180)
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
        cameraZ *= 1.5
        cameraRef.current.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ)
        controlsRef.current.target.copy(center)
        controlsRef.current.update()
      }

      console.log("[v0] IFC file loaded successfully!")
      setShowUpload(false)
    } catch (error) {
      console.error("[v0] Failed to load IFC file:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      alert(`Failed to load IFC file:\n\n${errorMessage}\n\nCheck the browser console for more details.`)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div ref={containerRef} className="h-full w-full relative bg-slate-950">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <div className="text-sm text-slate-400">Initializing viewer...</div>
        </div>
      )}

      {!isLoading && !isUploading && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-background/95 backdrop-blur"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon className="h-4 w-4" />
            Upload IFC File
          </Button>
          <input ref={fileInputRef} type="file" accept=".ifc" className="hidden" onChange={handleFileUpload} />
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20">
          <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="text-sm font-medium mb-2">Loading IFC File...</div>
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="text-xs text-slate-400 mt-2">{Math.round(uploadProgress)}%</div>
          </div>
        </div>
      )}
    </div>
  )
})

ViewerCanvas.displayName = "ViewerCanvas"

export { ViewerCanvas }
