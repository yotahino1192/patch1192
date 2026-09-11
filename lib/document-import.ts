import { unzipSync, strFromU8 } from "fflate";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_SOURCE_LENGTH = 30000;
export const DOCUMENT_ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.csv";

function parseXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("この資料の形式には対応していません。");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("資料が壊れているため読み取れませんでした。");
  return doc;
}

function checkedText(text: string): string {
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (!cleaned) throw new Error("文章を読み取れませんでした。画像だけの資料は、文章をコピーして入力してください。");
  if (cleaned.length > MAX_SOURCE_LENGTH) throw new Error("資料の文章が30,000文字を超えています。必要な部分だけを分けて取り込んでください。");
  return cleaned;
}

export function extractOfficeText(bytes: Uint8Array, extension: "docx" | "pptx"): string {
  let size = 0;
  const files = unzipSync(bytes, { filter: (file) => {
    const wanted = extension === "docx" ? file.name === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(file.name) || ["ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"].includes(file.name);
    if (!wanted) return false;
    size += file.originalSize;
    if (size > 8 * 1024 * 1024) throw new Error("資料が大きすぎます。必要な部分だけを分けて取り込んでください。");
    return true;
  } });
  let names = Object.keys(files).filter((name) => extension === "docx" || /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (extension === "pptx" && files["ppt/presentation.xml"] && files["ppt/_rels/presentation.xml.rels"]) {
    const presentation = parseXml(strFromU8(files["ppt/presentation.xml"]));
    const relations = parseXml(strFromU8(files["ppt/_rels/presentation.xml.rels"]));
    const targets = new Map(Array.from(relations.getElementsByTagNameNS("*", "Relationship")).filter((rel) => rel.getAttribute("TargetMode") !== "External").map((rel) => [rel.getAttribute("Id"), rel.getAttribute("Target") || ""]));
    names = Array.from(presentation.getElementsByTagNameNS("*", "sldId")).map((slide) => {
      const target = targets.get(slide.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")) || "";
      return target.startsWith("/") ? target.slice(1) : `ppt/${target}`;
    }).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name) && files[name]);
  }
  if (!names.length) throw new Error("資料の形式を確認してください。Wordは.docx、PowerPointは.pptxに対応しています。");
  const paragraphs: string[] = [];
  for (const name of names) {
    const xml = strFromU8(files[name]);
    const doc = parseXml(xml);
    const ns = extension === "docx" ? "http://schemas.openxmlformats.org/wordprocessingml/2006/main" : "http://schemas.openxmlformats.org/drawingml/2006/main";
    for (const paragraph of Array.from(doc.getElementsByTagNameNS(ns, "p"))) {
      const runs = Array.from(paragraph.getElementsByTagNameNS(ns, "t"));
      paragraphs.push(runs.map((run) => run.textContent || "").join(""));
    }
  }
  return checkedText(paragraphs.join("\n"));
}

export async function extractDocument(file: File, options: { workerSrc?: string } = {}): Promise<string> {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("ファイルは1つ10MB以内にしてください。");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["txt", "md", "csv"].includes(extension || "")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text: string;
    if (bytes[0] === 255 && bytes[1] === 254) text = new TextDecoder("utf-16le").decode(bytes);
    else if (bytes[0] === 254 && bytes[1] === 255) text = new TextDecoder("utf-16be").decode(bytes);
    else {
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder("shift-jis").decode(bytes); }
    }
    return checkedText(text);
  }
  if (extension === "docx" || extension === "pptx") return extractOfficeText(new Uint8Array(await file.arrayBuffer()), extension);
  if (extension !== "pdf") throw new Error("PDF・Word（.docx）・PowerPoint（.pptx）・TXT・Markdown・CSVに対応しています。");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = options.workerSrc || "/pdfjs/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, cMapUrl: "/pdfjs/cmaps/", cMapPacked: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 200) throw new Error("PDFは200ページ以内に分けて取り込んでください。");
    const pages: string[] = [];
    let length = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
      length += text.length;
      if (length > MAX_SOURCE_LENGTH) throw new Error("資料の文章が30,000文字を超えています。必要な部分だけを分けて取り込んでください。");
      pages.push(text);
      page.cleanup();
    }
    return checkedText(pages.join("\n\n"));
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new Error("パスワード付きPDFは、保護を解除してから添付してください。");
    throw error;
  } finally { await task.destroy(); }
}
