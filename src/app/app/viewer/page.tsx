"use client";

import { Suspense } from "react";
import ViewerPageInner from "./viewer-page-inner";

export default function ViewerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Laster viewer...</div>}>
      <ViewerPageInner />
    </Suspense>
  );
}
