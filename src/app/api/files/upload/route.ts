export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectMembership } from "@/lib/supabase-auth";
import { ingestScheduleFile, ingestTextDocument } from "@/lib/ingest";

const FILE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET || "project-files";
const MAX_SIZE_MB = 500;
const SIGNED_URL_TTL = 60 * 60;
const sanitizeFilename = (filename: string) => filename.replace(/[^\w.\-]+/g, "_");
const splitName = (filename: string) => {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) {
    return { stem: filename, ext: "" };
  }
  return { stem: filename.slice(0, lastDot), ext: filename.slice(lastDot + 1) };
};

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
    if (/^[-*\u2022]/.test(line) || /^\d+[\.\)]/.test(line) || /\b(skal|m\u00e5|must|shall)\b/i.test(line)) {
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

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
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

  const membership = await requireProjectMembership(supabase, projectId, user.id);
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "dat";
  const safeName = sanitizeFilename(file.name);
  const nameParts = splitName(safeName);
  let existing: Array<{ id: string; metadata?: Record<string, any> | null }> = [];
  let version = 1;
  const { data: existingRows } = await supabase
    .from("files")
    .select("id, metadata")
    .eq("project_id", projectId)
    .eq("name", file.name)
    .eq("type", file.type || "application/octet-stream");
  if (existingRows) {
    existing = existingRows as Array<{ id: string; metadata?: Record<string, any> | null }>;
    const maxVersion = existing.reduce((max, row) => {
      const v = Number(row.metadata?.version) || 1;
      return v > max ? v : max;
    }, 0);
    version = maxVersion + 1;
  }

  const versionSuffix = `__v${version}`;
  const path = `${projectId}/${nameParts.stem}${versionSuffix}${nameParts.ext ? `.${nameParts.ext}` : ""}`;
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

  const { data: signed } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);

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
          storage_url: null,
          source_provider: "supabase",
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString(),
          metadata: {
            category,
            ext,
            wordCount: textResult?.wordCount,
            pageCount: textResult?.pageCount,
            hasText: Boolean(textResult?.text),
            version,
            archived: false,
            originalName: file.name,
            bucket: FILE_BUCKET,
          },
        },
        { onConflict: "path" }
      )
      .select()
      .single();
    if (fileError) {
      console.warn("Kunne ikke lagre metadata i files-tabellen", fileError);
    }

    if (fileRow?.id && existing.length) {
      const previous = existing.filter((row) => row.id !== fileRow.id);
      for (const row of previous) {
        const merged = { ...(row.metadata || {}), archived: true };
        await supabase.from("files").update({ metadata: merged }).eq("id", row.id);
      }
    }
    const trimmedText = textResult?.text ? textResult.text.slice(0, 200_000) : "";
    if (fileRow?.id && trimmedText) {
      try {
        await supabase.from("file_texts").upsert(
          {
            file_id: fileRow.id,
            project_id: projectId,
            content: trimmedText,
            content_type: category,
            source_path: path,
            word_count: textResult.wordCount ?? countWords(trimmedText),
            page_count: textResult.pageCount ?? null,
          },
          { onConflict: "file_id" }
        );
      } catch (err) {
        console.warn("Lagring av tekst feilet", err);
      }

      const requirements = extractRequirements(trimmedText);
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

      try {
        await ingestTextDocument({
          projectId,
          fileId: fileRow.id,
          title: file.name,
          discipline: "generelt",
          reference: file.name,
          sourcePath: path,
          sourceType: category,
          text: trimmedText,
          userId: user.id,
        });
      } catch (err) {
        console.warn("Ingest (tekst) feilet", err);
      }
    }

    if (fileRow?.id && category === "spreadsheet") {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        await ingestScheduleFile({
          projectId,
          fileId: fileRow.id,
          filename: file.name,
          buffer,
          userId: user.id,
        });
      } catch (err) {
        console.warn("Ingest (fremdriftsplan) feilet", err);
      }
    }

    return NextResponse.json({
      path,
      publicUrl: signed?.signedUrl || null,
      provider: "supabase",
      fileId: fileRow?.id,
      category,
      hasText: Boolean(textResult?.text),
      version,
    });
  } catch (err) {
    console.warn("Metadata-lagring feilet", err);
    return NextResponse.json({
      path,
      publicUrl: signed?.signedUrl || null,
      provider: "supabase",
      category,
      hasText: Boolean(textResult?.text),
      version,
    });
  }
}
