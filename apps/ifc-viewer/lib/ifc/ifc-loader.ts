import * as THREE from "three"
import { IFCLoader } from "web-ifc-three/IFCLoader"

export interface IFCElement {
  expressID: number
  globalId: string
  type: string
  name: string
  properties: Record<string, any>
  mesh?: THREE.Mesh
}

export interface IFCModel {
  modelID: number
  mesh: THREE.Group
  elements: Map<number, IFCElement>
  spatialStructure: IFCSpatialNode[]
}

export interface IFCSpatialNode {
  expressID: number
  name: string
  type: string
  children: IFCSpatialNode[]
}

export class IFCModelLoader {
  private ifcLoader: IFCLoader | null = null
  private loadingProgress: (progress: number) => void
  private modelID = 0

  constructor(onProgress?: (progress: number) => void) {
    this.loadingProgress = onProgress || (() => {})
  }

  async init() {
    try {
      console.log("[v0] Initializing IFC Loader...")
      this.ifcLoader = new IFCLoader()

      console.log("[v0] Setting WASM path to /ifc/")
      await this.ifcLoader.ifcManager.setWasmPath("/ifc/")

      console.log("[v0] Applying WebIFC config...")
      await this.ifcLoader.ifcManager.applyWebIfcConfig({
        COORDINATE_TO_ORIGIN: true,
        USE_FAST_BOOLS: true,
      })

      console.log("[v0] IFC Loader initialized successfully")
    } catch (error) {
      console.error("[v0] Failed to initialize IFC Loader:", error)
      throw new Error(`IFC Loader initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  async createDemoBuilding(): Promise<IFCModel> {
    this.modelID++
    const group = new THREE.Group()
    const elements = new Map<number, IFCElement>()
    let expressID = 1

    this.loadingProgress(10)

    // Foundation
    const foundation = this.createBox(20, 1, 15, 0x808080)
    foundation.position.set(0, -0.5, 0)
    foundation.userData.expressID = expressID
    elements.set(expressID++, {
      expressID: expressID - 1,
      globalId: `foundation-${Math.random().toString(36).substr(2, 9)}`,
      type: "IFCFOOTING",
      name: "Foundation",
      properties: { Material: "Concrete", Height: "1m", LoadBearing: "Yes" },
      mesh: foundation,
    })
    group.add(foundation)

    this.loadingProgress(20)

    // Walls
    const wallPositions = [
      { x: 0, z: 7.5, width: 20, height: 6, depth: 0.3, name: "North Wall" },
      { x: 0, z: -7.5, width: 20, height: 6, depth: 0.3, name: "South Wall" },
      { x: 10, z: 0, width: 0.3, height: 6, depth: 15, name: "East Wall" },
      { x: -10, z: 0, width: 0.3, height: 6, depth: 15, name: "West Wall" },
    ]

    wallPositions.forEach((pos, i) => {
      const wall = this.createBox(pos.width, pos.height, pos.depth, 0xcccccc)
      wall.position.set(pos.x, pos.height / 2, pos.z)
      wall.userData.expressID = expressID
      elements.set(expressID++, {
        expressID: expressID - 1,
        globalId: `wall-${Math.random().toString(36).substr(2, 9)}`,
        type: "IFCWALL",
        name: pos.name,
        properties: { Material: "Concrete", Thickness: "0.3m", FireRating: "120min" },
        mesh: wall,
      })
      group.add(wall)
    })

    this.loadingProgress(40)

    // Floor
    const floor = this.createBox(19.4, 0.2, 14.4, 0xd4a574)
    floor.position.set(0, 0.1, 0)
    floor.userData.expressID = expressID
    elements.set(expressID++, {
      expressID: expressID - 1,
      globalId: `floor-${Math.random().toString(36).substr(2, 9)}`,
      type: "IFCSLAB",
      name: "Ground Floor",
      properties: { Material: "Wood", Thickness: "0.2m", LoadBearing: "No" },
      mesh: floor,
    })
    group.add(floor)

    this.loadingProgress(60)

    // Windows
    const windowPositions = [
      { x: -5, y: 3, z: 7.6, name: "North Window 1" },
      { x: 5, y: 3, z: 7.6, name: "North Window 2" },
      { x: -5, y: 3, z: -7.6, name: "South Window 1" },
      { x: 5, y: 3, z: -7.6, name: "South Window 2" },
    ]

    windowPositions.forEach((pos) => {
      const window = this.createBox(2, 2, 0.1, 0x87ceeb)
      window.position.set(pos.x, pos.y, pos.z)
      window.userData.expressID = expressID
      elements.set(expressID++, {
        expressID: expressID - 1,
        globalId: `window-${Math.random().toString(36).substr(2, 9)}`,
        type: "IFCWINDOW",
        name: pos.name,
        properties: { Material: "Glass", Width: "2m", Height: "2m", UValue: "1.2" },
        mesh: window,
      })
      group.add(window)
    })

    this.loadingProgress(75)

    // Columns
    const columnPositions = [
      { x: 7, z: 5, name: "Column NE" },
      { x: -7, z: 5, name: "Column NW" },
      { x: 7, z: -5, name: "Column SE" },
      { x: -7, z: -5, name: "Column SW" },
    ]

    columnPositions.forEach((pos) => {
      const column = this.createBox(0.5, 6, 0.5, 0x696969)
      column.position.set(pos.x, 3, pos.z)
      column.userData.expressID = expressID
      elements.set(expressID++, {
        expressID: expressID - 1,
        globalId: `column-${Math.random().toString(36).substr(2, 9)}`,
        type: "IFCCOLUMN",
        name: pos.name,
        properties: { Material: "Steel", Section: "HEB300", LoadBearing: "Yes" },
        mesh: column,
      })
      group.add(column)
    })

    this.loadingProgress(90)

    // Roof
    const roof = this.createBox(20, 0.3, 15, 0x8b4513)
    roof.position.set(0, 6.15, 0)
    roof.userData.expressID = expressID
    elements.set(expressID++, {
      expressID: expressID - 1,
      globalId: `roof-${Math.random().toString(36).substr(2, 9)}`,
      type: "IFCROOF",
      name: "Roof",
      properties: { Material: "Timber", Thickness: "0.3m", Insulation: "R-30" },
      mesh: roof,
    })
    group.add(roof)

    this.loadingProgress(100)

    const spatialStructure: IFCSpatialNode[] = [
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
      modelID: this.modelID,
      mesh: group,
      elements,
      spatialStructure,
    }
  }

  async loadFromFile(file: File): Promise<IFCModel> {
    if (!this.ifcLoader) {
      throw new Error("IFC Loader not initialized. Call init() first.")
    }

    console.log("[v0] Loading IFC file:", file.name, "Size:", file.size, "bytes")

    if (!file.name.toLowerCase().endsWith(".ifc")) {
      throw new Error("File must have .ifc extension")
    }

    this.modelID++
    const url = URL.createObjectURL(file)
    console.log("[v0] Created blob URL:", url)

    try {
      console.log("[v0] Starting IFC model load...")
      const ifcModel = await this.ifcLoader.loadAsync(url, (event) => {
        const progress = (event.loaded / event.total) * 100
        console.log("[v0] Loading progress:", progress.toFixed(1), "%")
        this.loadingProgress(progress)
      })

      console.log("[v0] IFC model loaded successfully, extracting properties...")
      this.loadingProgress(90)

      const elements = new Map<number, IFCElement>()
      const manager = this.ifcLoader.ifcManager

      console.log("[v0] Getting all IFC elements...")
      const allLines = await manager.getAllItemsOfType(this.modelID, 0, false)
      console.log("[v0] Found", allLines.length, "total elements")

      let processedCount = 0
      for (const id of allLines) {
        try {
          const props = await manager.getItemProperties(this.modelID, id, false)
          const type = props.type ? manager.getIfcType(this.modelID, props.type) : "Unknown"
          const name = props.Name?.value || props.LongName?.value || `Element ${id}`

          const properties: Record<string, any> = {}

          if (props.Description) properties.Description = props.Description.value
          if (props.ObjectType) properties.ObjectType = props.ObjectType.value
          if (props.Tag) properties.Tag = props.Tag.value

          try {
            if (props.IsDefinedBy) {
              for (const defRel of props.IsDefinedBy) {
                const relProps = await manager.getItemProperties(this.modelID, defRel.value, false)
                if (relProps.RelatingPropertyDefinition) {
                  const psetProps = await manager.getItemProperties(
                    this.modelID,
                    relProps.RelatingPropertyDefinition.value,
                    false,
                  )
                  if (psetProps.HasProperties) {
                    for (const propRef of psetProps.HasProperties) {
                      const prop = await manager.getItemProperties(this.modelID, propRef.value, false)
                      if (prop.Name && prop.NominalValue) {
                        properties[prop.Name.value] = prop.NominalValue.value
                      }
                    }
                  }
                }
              }
            }
          } catch (psetError) {
            console.warn(`[v0] Could not extract property sets for element ${id}`)
          }

          elements.set(id, {
            expressID: id,
            globalId: props.GlobalId?.value || `${id}`,
            type: type,
            name: name,
            properties: properties,
          })

          processedCount++
          if (processedCount % 100 === 0) {
            console.log("[v0] Processed", processedCount, "elements...")
          }
        } catch (error) {
          console.warn(`[v0] Failed to get properties for element ${id}:`, error)
        }
      }

      console.log("[v0] Processed", processedCount, "elements total")
      this.loadingProgress(95)

      console.log("[v0] Building spatial structure...")
      const spatialStructure = await this.buildSpatialStructure(manager, this.modelID)
      console.log("[v0] Spatial structure built:", spatialStructure.length, "root nodes")

      this.loadingProgress(100)
      URL.revokeObjectURL(url)

      console.log("[v0] IFC model fully loaded and processed")
      return {
        modelID: this.modelID,
        mesh: ifcModel,
        elements,
        spatialStructure,
      }
    } catch (error) {
      URL.revokeObjectURL(url)
      console.error("[v0] Error loading IFC file:", error)

      if (error instanceof Error) {
        if (error.message.includes("WASM")) {
          throw new Error("WebAssembly files not found. Make sure web-ifc WASM files are in /public/ifc/ folder.")
        } else if (error.message.includes("parse")) {
          throw new Error("Failed to parse IFC file. The file may be corrupted or not a valid IFC format.")
        }
        throw new Error(`Failed to load IFC file: ${error.message}`)
      }
      throw new Error("Failed to load IFC file. Please check the console for details.")
    }
  }

  private async buildSpatialStructure(manager: any, modelID: number): Promise<IFCSpatialNode[]> {
    try {
      const IFCPROJECT = 103090709
      const IFCSITE = 4097777520
      const IFCBUILDING = 4031249490
      const IFCBUILDINGSTOREY = 3124254112

      console.log("[v0] Looking for IFCPROJECT...")
      const projectIDs = await manager.getAllItemsOfType(modelID, IFCPROJECT, false)
      console.log("[v0] Found", projectIDs.length, "projects")

      if (projectIDs.length === 0) {
        console.warn("[v0] No IFCPROJECT found, returning empty structure")
        return []
      }

      const project = await manager.getItemProperties(modelID, projectIDs[0], false)
      const sites = await this.getRelatedElements(manager, modelID, project.expressID, IFCSITE)
      console.log("[v0] Found", sites.length, "sites")

      const structure: IFCSpatialNode[] = []

      for (const siteID of sites) {
        const site = await manager.getItemProperties(modelID, siteID, false)
        const buildings = await this.getRelatedElements(manager, modelID, siteID, IFCBUILDING)
        console.log("[v0] Site has", buildings.length, "buildings")

        const siteNode: IFCSpatialNode = {
          expressID: siteID,
          name: site.Name?.value || site.LongName?.value || "Site",
          type: "IFCSITE",
          children: [],
        }

        for (const buildingID of buildings) {
          const building = await manager.getItemProperties(modelID, buildingID, false)
          const storeys = await this.getRelatedElements(manager, modelID, buildingID, IFCBUILDINGSTOREY)
          console.log("[v0] Building has", storeys.length, "storeys")

          const buildingNode: IFCSpatialNode = {
            expressID: buildingID,
            name: building.Name?.value || building.LongName?.value || "Building",
            type: "IFCBUILDING",
            children: [],
          }

          for (const storeyID of storeys) {
            const storey = await manager.getItemProperties(modelID, storeyID, false)
            buildingNode.children.push({
              expressID: storeyID,
              name: storey.Name?.value || storey.LongName?.value || "Storey",
              type: "IFCBUILDINGSTOREY",
              children: [],
            })
          }

          siteNode.children.push(buildingNode)
        }

        structure.push(siteNode)
      }

      return structure
    } catch (error) {
      console.error("[v0] Failed to build spatial structure:", error)
      return []
    }
  }

  private async getRelatedElements(manager: any, modelID: number, elementID: number, type: number): Promise<number[]> {
    try {
      const element = await manager.getItemProperties(modelID, elementID, false)
      const relatedIDs: number[] = []

      if (element.IsDecomposedBy) {
        for (const rel of element.IsDecomposedBy) {
          const relProps = await manager.getItemProperties(modelID, rel.value, false)
          if (relProps.RelatedObjects) {
            for (const obj of relProps.RelatedObjects) {
              const objProps = await manager.getItemProperties(modelID, obj.value, false)
              if (objProps.type === type) {
                relatedIDs.push(obj.value)
              }
            }
          }
        }
      }

      return relatedIDs
    } catch (error) {
      return []
    }
  }

  private createBox(width: number, height: number, depth: number, color: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth)
    const material = new THREE.MeshStandardMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  dispose() {
    if (this.ifcLoader) {
      this.ifcLoader.ifcManager.dispose()
      this.ifcLoader = null
    }
  }
}
