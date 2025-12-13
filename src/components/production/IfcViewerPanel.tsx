"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

// Host wasm locally; fall back to CDN if needed
const WASM_LOCAL = typeof window !== "undefined" ? `${window.location.origin}/wasm/` : "/wasm/";
const WASM_CDN = "https://cdn.jsdelivr.net/npm/web-ifc@0.0.74/wasm/";

type Props = {
  file?: File;
  fileUrl?: string;
  modelName?: string;
};

export function IfcViewerPanel({ file, fileUrl, modelName }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const loadViewer = async () => {
    if ((!file && !fileUrl) || !containerRef.current) {
      setError("Ingen IFC-fil tilgjengelig i minnet. Last opp en fil i denne økten.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [{ default: THREE }, { IFCLoader }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/IFCLoader.js"),
      ]);

      const width = containerRef.current.clientWidth || 640;
      const height = 480;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf8fafc);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(5, 5, 5);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio || 1);

      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(renderer.domElement);

      const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
      hemi.position.set(0, 20, 0);
      scene.add(hemi);

      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(10, 10, 10);
      scene.add(dir);

      const grid = new THREE.GridHelper(20, 20, 0xe2e8f0, 0xe2e8f0);
      scene.add(grid);

      const controlsModule = await import("three/examples/jsm/controls/OrbitControls.js");
      const OrbitControls = (controlsModule as any).OrbitControls || controlsModule.default;
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 1, 0);
      controls.update();

      const loader = new IFCLoader();
      try {
        loader.ifcManager.setWasmPath(WASM_LOCAL);
      } catch (err) {
        console.warn("WASM local path failed, falling back to CDN", err);
        loader.ifcManager.setWasmPath(WASM_CDN);
      }

      let arrayBuffer: ArrayBuffer;
      if (file) {
        arrayBuffer = await file.arrayBuffer();
      } else {
        const res = await fetch(fileUrl!);
        arrayBuffer = await res.arrayBuffer();
      }
      const buffer = new Uint8Array(arrayBuffer);
      await new Promise<void>((resolve, reject) => {
        loader.parse(
          buffer.buffer,
          "",
          (model: any) => {
            scene.add(model);
            resolve();
          },
          (err: any) => reject(err)
        );
      });

      let animId: number;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        const w = containerRef.current?.clientWidth || width;
        const h = containerRef.current?.clientHeight || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      cleanupRef.current = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", onResize);
        controls.dispose();
        renderer.dispose();
        loader.ifcManager?.close(0);
      };
    } catch (err: any) {
      console.error("IFC viewer error", err);
      setError("Kunne ikke laste IFC-viewer. Sjekk at wasm er tilgjengelig (public/wasm) og at filen finnes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">IFC Viewer (eksperimentell)</p>
          <p className="text-xs text-slate-600">
            Laster geometri i nettleseren via web-ifc. Filen må være lastet opp i denne økten.
          </p>
        </div>
        <Button size="sm" onClick={loadViewer} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Last modell
        </Button>
      </div>
      <div ref={containerRef} className="w-full h-[480px] rounded-lg border border-slate-200 bg-white overflow-hidden" />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-slate-500">
        Viewer prøver {WASM_LOCAL} først (fallback {WASM_CDN}). For produksjon bør wasm hostes lokalt.
      </p>
      {modelName && <p className="text-xs text-slate-500">Modell: {modelName}</p>}
    </div>
  );
}
