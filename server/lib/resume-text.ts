import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export function extractEmail(text: string): string {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches?.[0] ?? "";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractFallbackText(buffer: Buffer): string {
  try {
    return buffer.toString("utf-8", 0, Math.min(buffer.length, 200_000));
  } catch {
    return buffer.toString("latin1", 0, Math.min(buffer.length, 200_000));
  }
}

export async function extractTextFromResume(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    try {
      return await extractPdfText(buffer);
    } catch {
      return extractFallbackText(buffer);
    }
  }

  if (lower.endsWith(".docx")) {
    try {
      return await extractDocxText(buffer);
    } catch {
      return extractFallbackText(buffer);
    }
  }

  return extractFallbackText(buffer);
}
