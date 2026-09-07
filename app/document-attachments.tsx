"use client";
import { useRef, useState } from "react";
import { DOCUMENT_ACCEPT, extractDocument } from "../lib/document-import";
import { useLanguage } from "./language";

export type Attachment = { id: string; name: string; text: string };
export function DocumentAttachments({ files, onChange, onBusy, disabled }: { files: Attachment[]; onChange: (files: Attachment[]) => void; onBusy: (busy: boolean) => void; disabled: boolean }) {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="document-attachments">
    <input ref={input} type="file" accept={DOCUMENT_ACCEPT} multiple hidden disabled={disabled || busy} onChange={async (event) => {
      const selected = Array.from(event.target.files || []);
      event.target.value = "";
      if (!selected.length || working.current) return;
      setError("");
      if (files.length + selected.length > 5) { setError(t("資料は5ファイルまで添付できます。")); return; }
      working.current = true; setBusy(true); onBusy(true);
      try {
        const additions: Attachment[] = [];
        for (const file of selected) additions.push({ id: crypto.randomUUID(), name: file.name, text: await extractDocument(file) });
        onChange([...files, ...additions]);
      } catch (error) { setError(t(error instanceof Error && /[\u3000-\u9fff]/.test(error.message) ? error.message : "資料を読み取れませんでした。ファイル形式と内容を確認してください。")); }
      finally { working.current = false; setBusy(false); onBusy(false); }
    }} />
    <button type="button" className="secondary attach-button" disabled={disabled || busy} onClick={() => input.current?.click()}>{busy ? t("資料を読み取り中…") : t("＋ 資料を添付")}</button>
    <p className="attachment-hint attachment-formats">{t(".pdf・.docx・.pptx・.txt・.md・.csv ／ 各10MB")}</p>
    {files.length > 0 && <ul className="attachment-list">{files.map((file) => <li key={file.id}><details><summary>{file.name}<small>{t("{0}文字", file.text.length)}</small></summary><p>{file.text}</p></details><button type="button" disabled={disabled || busy} aria-label={t("{0}を削除", file.name)} onClick={() => onChange(files.filter((item) => item.id !== file.id))}>×</button></li>)}</ul>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}
