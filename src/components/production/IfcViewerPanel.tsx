"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const WASM_LOCAL = "/wasm/";
const WASM_CDN = "https://cdn.jsdelivr.net/npm/web-ifc@0.0.74/wasm/";

type Props = {
  file?: File;
  fileUrl?: string;
  modelName?: string;
  autoLoad?: boolean;
};

export function IfcViewerPanel({ file, fileUrl, modelName, autoLoad }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSource = useRef<string | null>(null);

  const loadViewer = useCallback(async () => {
    if ((!file && !fileUrl) || !containerRef.current) {
      setError("Ingen IFC-fil-URL tilgjengelig. Velg en fil i prosjektet først.");
      return;
    }

    const sourceKey = fileUrl || file?.name || "";
    if (sourceKey === lastSource.current) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [{ default: THREE }, { IFCLoader, OrbitControls }] = await Promise.all([
        import("three"),
        import("three-stdlib"),
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

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 1, 0);
      controls.update();

      const loader = new IFCLoader();
      try {
        loader.ifcManager.setWasmPath(WASM_LOCAL);
      } catch (err) {
        console.warn("Kunne ikke sette lokal wasm-path, bruker CDN", err);
        loader.ifcManager.setWasmPath(WASM_CDN);
      }

      let arrayBuffer: ArrayBuffer;
      if (file) {
        arrayBuffer = await file.arrayBuffer();
      } else {
        const res = await fetch(fileUrl!, { cache: "no-store" });
        if (!res.ok) throw new Error(`Kunne ikke hente IFC fra URL (status ${res.status})`);
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

      const resize = () => {
        const w = containerRef.current?.clientWidth || width;
        const h = containerRef.current?.clientHeight || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", resize);

      cleanupRef.current = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", resize);
        controls.dispose();
        renderer.dispose();
        loader.ifcManager?.close(0);
      };

      lastSource.current = sourceKey;
    } catch (err: any) {
      console.error("IFC viewer error", err);
      setError("Kunne ikke laste IFC-viewer. Kontroller wasm (/wasm) og at filen er tilgjengelig.");
    } finally {
      setLoading(false);
    }
  }, [file, fileUrl]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadViewer();
    }
  }, [autoLoad, loadViewer]);

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-slate-800">IFC Viewer</p>
        <p className="text-xs text-slate-500">
          Geometri lastes i nettleseren. Modeller åpnes automatisk når en fil-URL er satt for prosjektet.
        </p>
      </div>
      <div
        ref={containerRef}
        className="w-full h-[460px] rounded-xl border border-border bg-card shadow-sm"
        aria-live="polite"
      />
      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Laster IFC-modell...
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-slate-500">
        Let etter wasm under {WASM_LOCAL} (CDN fallback {WASM_CDN}). Til produksjon bør wasm hostes lokalt.
      </p>
      {modelName && <p className="text-xs text-slate-500">Modell: {modelName}</p>}
    </div>
  );
}
