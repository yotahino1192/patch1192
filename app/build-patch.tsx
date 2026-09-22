"use client";
import { useRef, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import type { AppData } from '../lib/types';
import type { ImportDraft } from '../lib/workspace';
import { normalizeBuildDraft, materialSource, materialError, type BuildDraft } from '../lib/build-draft';
import { DOCUMENT_ACCEPT, extractDocument } from '../lib/document-import';
import { MIN_SOURCE_LENGTH, MAX_SOURCE_LENGTH, MAX_DOCUMENT_BYTES, MAX_ATTACHMENTS, MAX_FOCUS_LENGTH } from '../lib/material-limits';
import { useLanguage } from './language';
import { localizeBuildError } from './build-copy';
import { Mascot } from './mascot';
import { PatchIcon } from './patch-ui';
import { SettingsDialog } from './settings-dialog';

type Props = {
  data: Pick<AppData, 'sets'>; destination: string; setDestination: (value: string) => void;
  importDraft: ImportDraft; setImportDraft: Dispatch<SetStateAction<ImportDraft>>;
  onGenerate: () => Promise<void>; generationRunning?: boolean; review?: ReactNode;
  reviewLocked?: boolean;
  patchesLoading?: boolean; patchesError?: string; onRetryPatches?: () => void;
};
function Radio({ selected }: { selected: boolean }) { return <span className={`build-radio ${selected ? 'selected' : ''}`} aria-hidden="true" />; }

export function ImportScreen({ data, destination, setDestination, importDraft, setImportDraft, onGenerate, generationRunning = false, review, reviewLocked = false, patchesLoading, patchesError, onRetryPatches }: Props) {
  const { t, language, locale } = useLanguage();
  const build = normalizeBuildDraft(importDraft.build, destination);
  const { step } = build;
  const heading = useRef<HTMLHeadingElement>(null);
  const settings = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');
  const update = (patch: Partial<BuildDraft>) => setImportDraft(d => ({ ...d, build: { ...normalizeBuildDraft(d.build, destination), ...patch } }));
  useEffect(() => { heading.current?.focus(); }, [step]);
  const source = materialSource(importDraft);
  const invalid = materialError(importDraft);
  const formatValid = ['一問一答', '4択問題'].includes(importDraft.style);
  const reading = importDraft.attachments.some(a => a.status === 'reading');
  const destinationValid = build.destinationMode === 'new' || (!patchesLoading && !patchesError && data.sets.some(s => s.id === build.existingPatchId));
  const hasMaterial = importDraft.inputKind !== 'topic' && (source.length >= MIN_SOURCE_LENGTH || importDraft.attachments.some(a => !a.status || a.status === 'accepted'));
  const focusInvalid = hasMaterial && build.coverage === 'focus' && (!build.focus.trim() || build.focus.length > MAX_FOCUS_LENGTH);
  const setMode = (destinationMode: 'new' | 'existing') => {
    update({ destinationMode });
    setDestination(destinationMode === 'existing' ? `set:${build.existingPatchId}` : destination.startsWith('folder:') ? destination : 'root');
  };
  const choosePatch = (id: string) => { update({ existingPatchId: id }); setDestination(`set:${id}`); };
  const generate = () => { if (!invalid && !focusInvalid && destinationValid && formatValid) void onGenerate(); };
  const upload = async (selected: File[]) => {
    const slots = Math.max(0, MAX_ATTACHMENTS - importDraft.attachments.length);
    setUploadError('');
    if (selected.length > slots) { setUploadError("ファイルは{0}個まで添付できます。数を減らしてもう一度お試しください。"); return; }
    setImportDraft(d => ({ ...d, inputKind: 'source' }));
    const files = selected.slice(0, slots).map(file => ({ file, id: crypto.randomUUID() }));
    setImportDraft(d => ({ ...d, attachments: [...d.attachments, ...files.map(({ file, id }) => ({ id, name: file.name, text: '', size: file.size, status: 'reading' as const }))] }));
    for (const { file, id } of files) {
      try {
        const text = await extractDocument(file);
        setImportDraft(d => ({ ...d, attachments: d.attachments.map(a => a.id === id ? { ...a, text, status: 'accepted', error: undefined } : a) }));
      } catch (error) {
        const message = error instanceof Error && /[\u3000-\u9fff]/.test(error.message) ? error.message : "ファイルを読み込めませんでした。形式を確認して、もう一度お試しください。";
        setImportDraft(d => ({ ...d, attachments: d.attachments.map(a => a.id === id ? { ...a, status: 'failed', error: message } : a) }));
      }
    }
  };
  return <div className={`build-flow import-page build-step-${step}`} lang={language}>
    <header className="build-header">
      {step !== 1 && step !== 'preparing' ? <button type="button" className="build-back" aria-label={t("戻る")} disabled={step === 'review' && reviewLocked} onClick={() => update({ step: step === 'review' ? 3 : step === 3 ? 2 : 1 })}><PatchIcon name="chevron" /></button> : <span />}
      <span className="build-wordmark">{step === 'review' ? t("パッチの確認") : t("パッチを作成")}</span>
      <button type="button" className="build-profile" aria-label={t("プロフィールと設定")} aria-haspopup="dialog" onClick={() => settings.current?.showModal()}><svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="16" cy="16" r="14" stroke="#cad8e7" /><circle cx="16" cy="11" r="4" /><path d="M9 24v-2a7 7 0 0 1 14 0v2" /></svg></button>
    </header>
    <SettingsDialog dialogRef={settings} />
    {typeof step === 'number' && <div className="build-progress" aria-label={t("全3ステップ中の{0}", step)}><div aria-hidden="true">{[1, 2, 3].map(n => <span key={n} className={n <= step ? 'done' : ''} />)}</div><p>{t("全3ステップ中の{0}", step)}</p></div>}
    {step === 1 && <section className="build-content build-destination">
      <div className="build-destination-heading"><Mascot pose="hello" /><h1 ref={heading} tabIndex={-1}>{t("保存先を選びましょう")}</h1></div>
      <fieldset className="build-destinations"><legend className="sr-only">{t("保存先")}</legend>
        <label className={`build-destination-option ${build.destinationMode === 'new' ? 'selected' : ''}`}><input type="radio" name="destination" checked={build.destinationMode === 'new'} onChange={() => setMode('new')} /><span className="build-plus"><PatchIcon name="plus" size={23} /></span><span><strong>{t("新しいパッチを作成")}</strong><small>{t("新しい学習コレクションを作ります")}</small></span><Radio selected={build.destinationMode === 'new'} /></label>
        <label className={`build-destination-option ${build.destinationMode === 'existing' ? 'selected' : ''}`}><input type="radio" name="destination" checked={build.destinationMode === 'existing'} onChange={() => setMode('existing')} /><PatchIcon name="folder" size={36} /><span><strong>{t("既存のパッチに追加")}</strong><small>{t("保存済みのパッチに教材を追加します")}</small></span><Radio selected={build.destinationMode === 'existing'} /></label>
      </fieldset>
      {build.destinationMode === 'existing' && <fieldset className="build-patch-list"><legend>{t("パッチを選択")}</legend>
        {patchesLoading ? <p role="status">{t("パッチを読み込んでいます…")}</p> : patchesError ? <div role="alert"><p>{t("パッチを読み込めませんでした。")}</p><button type="button" onClick={onRetryPatches}>{t("再試行")}</button></div> : !data.sets.length ? <p>{t("パッチがありません。「新しいパッチを作成」を選んで始めましょう。")}</p> : data.sets.map(s => <label key={s.id} className={build.existingPatchId === s.id ? 'selected' : ''}><input type="radio" name="existing-patch" checked={build.existingPatchId === s.id} onChange={() => choosePatch(s.id)} /><PatchIcon name="book" /><span>{s.title}</span><Radio selected={build.existingPatchId === s.id} /></label>)}
      </fieldset>}
    </section>}
    {step === 2 && <section className="build-content build-material">
      <h1 ref={heading} tabIndex={-1}>{t("何を学びたいですか？")}</h1>
      <label className="build-helper">{t("入力の種類")}<select aria-label={t("入力の種類")} value={importDraft.inputKind || 'source'} onChange={e => setImportDraft(d => ({ ...d, inputKind: e.target.value as 'source' | 'topic' }))}><option value="source">{t("元の教材")}</option><option value="topic" disabled={!!importDraft.attachments.length}>{t("トピック")}</option></select></label>
      <div className="build-text"><textarea aria-label={t("教材のテキスト")} aria-describedby="build-material-help build-count" placeholder={importDraft.inputKind === 'topic' ? t("例：金利、光合成、日本語の助詞") : t("テキストを貼り付けてください…\n例：ChatGPTの会話、記事、授業のノート")} maxLength={MAX_SOURCE_LENGTH} value={importDraft.text} onChange={e => setImportDraft(d => ({ ...d, text: e.target.value }))} /><span id="build-count">{importDraft.text.length.toLocaleString(locale)} / {MAX_SOURCE_LENGTH.toLocaleString(locale)}</span></div>
      <input ref={input} type="file" aria-label={t("学習ファイルをアップロード")} accept={DOCUMENT_ACCEPT} multiple hidden disabled={reading || importDraft.attachments.length >= MAX_ATTACHMENTS} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void upload(files); }} />
      <button className="build-upload" type="button" disabled={reading || importDraft.attachments.length >= MAX_ATTACHMENTS} onClick={() => input.current?.click()}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9a4 4 0 0 1 6 6l-8 8a2 2 0 0 1-3-3l7-7" /></svg>{t("ファイルをアップロード")}</button>
      <p className="build-formats">{DOCUMENT_ACCEPT.split(',').join(' · ')}<br />{t("1ファイル{0} MBまで・最大{1}ファイル", MAX_DOCUMENT_BYTES / 1024 / 1024, MAX_ATTACHMENTS)}</p>
      {uploadError && <p className="build-error" role="alert">{t(uploadError, MAX_ATTACHMENTS)}</p>}
      {!!importDraft.attachments.length && <ul className="build-files">{importDraft.attachments.map(file => <li key={file.id}>
        <PatchIcon name="document" size={30} /><div><strong>{file.name}</strong><small>{file.size !== undefined ? file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB` : t("{0}文字", file.text.length.toLocaleString(locale))}</small></div>
        <span className="build-file-status" role="status"><span className="sr-only">{file.name}: {file.status === 'reading' ? t("ファイルを確認中") : file.status === 'failed' ? t("ファイルを受け付けられませんでした") : t("処理の準備ができました")}</span><span aria-hidden="true">{file.status === 'reading' ? '…' : file.status === 'failed' ? '!' : <PatchIcon name="check" size={16} />}</span></span><button type="button" aria-label={t("{0}を削除", file.name)} onClick={() => setImportDraft(d => ({ ...d, attachments: d.attachments.filter(a => a.id !== file.id) }))}><PatchIcon name="close" size={22} /></button>
        {file.error && <p className="build-file-error" role="alert">{localizeBuildError(file.error, t)}</p>}
      </li>)}</ul>}
      <p id="build-material-help" className="build-helper">{importDraft.inputKind === 'topic' ? t("トピックを1〜200文字で入力してください。AIが一般知識を使って教材を作ります。") : t("ファイルを含め80〜30,000文字の教材を入力してください。PDFはテキスト形式のみ対応しています（200ページまで）。")}</p>
      <p className="build-helper">{t("AIの処理上限により、日本語などでは教材を短くする必要がある場合があります。")}</p>
      {!!source.length && invalid && !reading && <p className="build-error" role="status">{localizeBuildError(invalid, t)}</p>}
      {!!importDraft.attachments.length && <p className="build-helper">{t("教材の合計：{0} / 30,000文字", source.length.toLocaleString(locale))}</p>}
    </section>}
    {step === 3 && <section className="build-content build-customize">
      <h1 ref={heading} tabIndex={-1}>{t("学習内容を設定")}</h1>
      {hasMaterial && <fieldset className="build-coverage"><legend>{t("学習範囲")}</legend>
        <label className={`build-choice ${build.coverage === 'whole' ? 'selected' : ''}`}><input type="radio" name="coverage" checked={build.coverage === 'whole'} onChange={() => update({ coverage: 'whole' })} /><Radio selected={build.coverage === 'whole'} /><strong>{t("教材全体")}</strong></label>
        <div className={`build-focus ${build.coverage === 'focus' ? 'selected' : ''}`}><label className="build-choice"><input type="radio" name="coverage" checked={build.coverage === 'focus'} onChange={() => update({ coverage: 'focus' })} /><Radio selected={build.coverage === 'focus'} /><span><strong>{t("特定の内容を重点的に学ぶ")}</strong>{build.coverage === 'focus' && <small>{t("重点的に学びたい内容を入力してください。")}</small>}</span></label>
          {build.coverage === 'focus' && <div className="build-focus-field"><label htmlFor="build-focus">{t("重点的に学ぶ内容")}</label><textarea id="build-focus" value={build.focus} maxLength={MAX_FOCUS_LENGTH} aria-invalid={focusInvalid} aria-describedby={focusInvalid ? 'build-focus-error' : undefined} onChange={e => update({ focus: e.target.value })} />{focusInvalid && <p id="build-focus-error" className="build-error">{t("重点的に学ぶ内容を入力してください。")}</p>}</div>}
        </div>
        {build.coverage === 'whole' && <p className="build-helper">{t("教材全体の主な内容を学習します。")}</p>}
      </fieldset>}
      <fieldset className="build-detail"><legend>{t("詳しさ")}</legend><div>{[['要点のみ', t("要点のみ"), t("重要な内容")], ['標準', t("標準"), t("バランスよく")], ['詳しく', t("詳しく"), t("深く学ぶ")]].map(([value, title, subtitle]) => <label key={value} className={`build-choice ${importDraft.detail === value ? 'selected' : ''}`}><input type="radio" name="detail" checked={importDraft.detail === value} onChange={() => setImportDraft(d => ({ ...d, detail: value }))} /><Radio selected={importDraft.detail === value} /><span><strong>{title}</strong><small>{subtitle}</small></span></label>)}</div></fieldset>
      <fieldset className="build-format"><legend>{t("学習形式")}</legend><div>{[['一問一答', t("フラッシュカード"), t("答えを思い出す")], ['4択問題', t("選択問題"), t("答えを選ぶ")]].map(([value, title, subtitle]) => <label key={value} className={`build-choice ${importDraft.style === value ? 'selected' : ''}`}><input type="radio" name="format" checked={importDraft.style === value} onChange={() => setImportDraft(d => ({ ...d, style: value }))} /><Radio selected={importDraft.style === value} /><span><strong>{title}</strong><small>{subtitle}</small></span></label>)}</div></fieldset>
      {invalid && <p className="build-error" role="alert">{localizeBuildError(invalid, t)}</p>}
      {!formatValid && <p className="build-error" role="alert">{t("この下書きを続けるには、フラッシュカードか選択問題を選んでください。")}</p>}
      {!destinationValid && <p className="build-error" role="alert">{t("ステップ1で利用可能なパッチを選んでください。")}</p>}
    </section>}
    {step === 'preparing' && <section className="build-preparing">
      <Mascot pose="finding" /><h1 ref={heading} tabIndex={-1}>{generationRunning ? t("パッチを準備しています…") : build.generation.outcome === 'final' ? t("生成が完了しませんでした") : t("パッチの作成を再開しましょう")}</h1>
      {generationRunning ? <div role="status"><p>{t("少しお待ちください。")}</p><span className="build-dots" aria-hidden="true"><i /><i /><i /></span></div> : <div><p role="alert">{localizeBuildError(build.generation.error || "教材は保持されています。再試行して中断したリクエストを確認してください。", t)}</p><button type="button" className="build-primary" onClick={generate}>{build.generation.outcome === 'final' ? t("もう一度生成") : t("再試行")}</button><button type="button" className="build-return" onClick={() => update({ step: 3 })}>{t("学習設定に戻る")}</button></div>}
    </section>}
    {step === 'review' && review}
    {typeof step === 'number' && <div className="build-actions"><button type="button" className="build-primary" disabled={step === 1 ? !destinationValid : step === 2 ? !!invalid : !!invalid || focusInvalid || !destinationValid || !formatValid || generationRunning} onClick={() => step === 3 ? generate() : update({ step: step === 1 ? 2 : 3 })}>{step === 3 ? t("パッチを生成") : t("続ける")}</button></div>}
  </div>;
}
