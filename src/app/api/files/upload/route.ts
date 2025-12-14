export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const FILE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET ||
  "ifc-models";

const MAX_SIZE_MB = 500;

type ExtractedText = {
  text: string;
  wordCount?: number;
  pageCount?: number;
};

const detectCategory = (filename: string, mime: string) => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "ifc" || ext === "ifczip") return "ifc";
  if (["pdf"].includes(ext)) return "pdf";
  if (["doc", "docx", "rtf", "txt", "md"].includes(ext)) return "document";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet";
  if (mime.includes("image/")) return "image";
  return "other";
};

const countWords = (text: string) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);

const extractRequirements = (text: string) => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const reqs: string[] = [];
  for (const line of lines) {
    if (/^[-*•]/.test(line) || /^\d+[\.\)]/.test(line) || /\b(skal|må|must|shall)\b/i.test(line)) {
      reqs.push(line);
    }
    if (reqs.length >= 200) break;
  }
  return reqs;
};

const extractTextFromFile = async (file: File, category: string): Promise<ExtractedText | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (category === "pdf") {
      const pdfMod = await import("pdf-parse");
      const pdfParse: any = (pdfMod as any).default || pdfMod;
      const result = await pdfParse(buffer);
      const text: string = result?.text || "";
      return {
        text,
        wordCount: countWords(text),
        pageCount: result?.numpages || result?.info?.Pages,
      };
    }

    if (category === "document") {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      const text: string = value || "";
      return {
        text,
        wordCount: countWords(text),
      };
    }

    if (category === "spreadsheet") {
      // Future: add XLSX/CSV parsing. For now, skip heavy parsing.
      return null;
    }

    return null;
  } catch (err) {
    console.warn("Kunne ikke ekstrahere tekst", err);
    return null;
  }
};

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const projectId = (form.get("projectId") as string) || "";
  const description = (form.get("description") as string) || "";

  if (!file || !projectId) {
    return NextResponse.json({ error: "Mangler file eller projectId" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Filen er for stor (maks ${MAX_SIZE_MB} MB)` }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "dat";
  const path = `${projectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const category = detectCategory(file.name, file.type || "");

  const textResult = ["pdf", "document"].includes(category) ? await extractTextFromFile(file, category) : null;

  const { error: uploadError } = await supabase.storage.from(FILE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) {
    console.error("Supabase upload error", uploadError);
    return NextResponse.json({ error: "Opplasting feilet" }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from(FILE_BUCKET).getPublicUrl(path);

  // Persist metadata
  try {
    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .upsert(
        {
          project_id: projectId,
          name: file.name,
          path,
          type: file.type || "application/octet-stream",
          size: file.size,
          description,
          storage_url: publicData.publicUrl,
          source_provider: "supabase",
          uploaded_by: "system",
          uploaded_at: new Date().toISOString(),
          metadata: {
            category,
            ext,
            wordCount: textResult?.wordCount,
            pageCount: textResult?.pageCount,
            hasText: Boolean(textResult?.text),
          },
        },
        { onConflict: "path" }
      )
      .select()
      .single();
    if (fileError) {
      console.warn("Kunne ikke lagre metadata i files-tabellen", fileError);
    }

    if (fileRow?.id && textResult?.text) {
      const trimmed = textResult.text.slice(0, 200_000);
      try {
        await supabase.from("file_texts").upsert(
          {
            file_id: fileRow.id,
            project_id: projectId,
            content: trimmed,
            content_type: category,
            source_path: path,
            word_count: textResult.wordCount ?? countWords(trimmed),
            page_count: textResult.pageCount ?? null,
          },
          { onConflict: "file_id" }
        );
      } catch (err) {
        console.warn("Lagring av tekst feilet", err);
      }

      const requirements = extractRequirements(trimmed);
      if (requirements.length) {
        try {
          const payload = requirements.slice(0, 100).map((text) => ({
            file_id: fileRow.id,
            project_id: projectId,
            text: text.slice(0, 2000),
            source_path: path,
          }));
          await supabase.from("file_requirements").upsert(payload, { onConflict: "file_id,text" });
        } catch (err) {
          console.warn("Lagring av krav feilet", err);
        }
      }
    }

    return NextResponse.json({
      path,
      publicUrl: publicData.publicUrl,
      provider: "supabase",
      fileId: fileRow?.id,
      category,
      hasText: Boolean(textResult?.text),
    });
  } catch (err) {
    console.warn("Metadata-lagring feilet", err);
    return NextResponse.json({
      path,
      publicUrl: publicData.publicUrl,
      provider: "supabase",
      category,
      hasText: Boolean(textResult?.text),
    });
  }
}
