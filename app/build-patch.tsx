"use client";
import { useRef, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import type { AppData } from '../lib/types';
import type { ImportDraft } from '../lib/workspace';
import { normalizeBuildDraft, materialSource, materialError, type BuildDraft } from '../lib/build-draft';
import { DOCUMENT_ACCEPT, extractDocument } from '../lib/document-import';
import { MIN_SOURCE_LENGTH, MAX_SOURCE_LENGTH, MAX_DOCUMENT_BYTES, MAX_ATTACHMENTS, MAX_FOCUS_LENGTH } from '../lib/material-limits';
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
    if (selected.length > slots) { setUploadError(`You can attach up to ${MAX_ATTACHMENTS} files. Select fewer files and try again.`); return; }
    setImportDraft(d => ({ ...d, inputKind: 'source' }));
    const files = selected.slice(0, slots).map(file => ({ file, id: crypto.randomUUID() }));
    setImportDraft(d => ({ ...d, attachments: [...d.attachments, ...files.map(({ file, id }) => ({ id, name: file.name, text: '', size: file.size, status: 'reading' as const }))] }));
    for (const { file, id } of files) {
      try {
        const text = await extractDocument(file);
        setImportDraft(d => ({ ...d, attachments: d.attachments.map(a => a.id === id ? { ...a, text, status: 'accepted', error: undefined } : a) }));
      } catch (error) {
        const message = error instanceof Error && /[\u3000-\u9fff]/.test(error.message) ? error.message : 'This file could not be read. Check its format and try again.';
        setImportDraft(d => ({ ...d, attachments: d.attachments.map(a => a.id === id ? { ...a, status: 'failed', error: message } : a) }));
      }
    }
  };
  return <div className={`build-flow import-page build-step-${step}`} lang="en">
    <header className="build-header">
      {step !== 1 && step !== 'preparing' ? <button type="button" className="build-back" aria-label="Back" disabled={step === 'review' && reviewLocked} onClick={() => update({ step: step === 'review' ? 3 : step === 3 ? 2 : 1 })}><PatchIcon name="chevron" /></button> : <span />}
      <span className="build-wordmark">{step === 'review' ? 'Review your Patch' : 'Build Patch'}</span>
      <button type="button" className="build-profile" aria-label="Profile and settings" aria-haspopup="dialog" onClick={() => settings.current?.showModal()}><svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="16" cy="16" r="14" stroke="#cad8e7" /><circle cx="16" cy="11" r="4" /><path d="M9 24v-2a7 7 0 0 1 14 0v2" /></svg></button>
    </header>
    <SettingsDialog dialogRef={settings} />
    {typeof step === 'number' && <div className="build-progress" aria-label={`Step ${step} of 3`}><div aria-hidden="true">{[1, 2, 3].map(n => <span key={n} className={n <= step ? 'done' : ''} />)}</div><p>Step {step} of 3</p></div>}
    {step === 1 && <section className="build-content build-destination">
      <div className="build-destination-heading"><Mascot pose="hello" /><h1 ref={heading} tabIndex={-1}>Where should this go?</h1></div>
      <fieldset className="build-destinations"><legend className="sr-only">Destination</legend>
        <label className={`build-destination-option ${build.destinationMode === 'new' ? 'selected' : ''}`}><input type="radio" name="destination" checked={build.destinationMode === 'new'} onChange={() => setMode('new')} /><span className="build-plus"><PatchIcon name="plus" size={23} /></span><span><strong>Create a new Patch</strong><small>Start a new learning collection</small></span><Radio selected={build.destinationMode === 'new'} /></label>
        <label className={`build-destination-option ${build.destinationMode === 'existing' ? 'selected' : ''}`}><input type="radio" name="destination" checked={build.destinationMode === 'existing'} onChange={() => setMode('existing')} /><PatchIcon name="folder" size={36} /><span><strong>Add to an existing Patch</strong><small>Build on what you already have</small></span><Radio selected={build.destinationMode === 'existing'} /></label>
      </fieldset>
      {build.destinationMode === 'existing' && <fieldset className="build-patch-list"><legend>Choose a Patch</legend>
        {patchesLoading ? <p role="status">Loading your Patches…</p> : patchesError ? <div role="alert"><p>We could not load your Patches.</p><button type="button" onClick={onRetryPatches}>Retry</button></div> : !data.sets.length ? <p>No Patches yet. Choose “Create a new Patch” to get started.</p> : data.sets.map(s => <label key={s.id} className={build.existingPatchId === s.id ? 'selected' : ''}><input type="radio" name="existing-patch" checked={build.existingPatchId === s.id} onChange={() => choosePatch(s.id)} /><PatchIcon name="book" /><span>{s.title}</span><Radio selected={build.existingPatchId === s.id} /></label>)}
      </fieldset>}
    </section>}
    {step === 2 && <section className="build-content build-material">
      <h1 ref={heading} tabIndex={-1}>What do you want to learn?</h1>
      <label className="build-helper">Input type <select aria-label="Input type" value={importDraft.inputKind || 'source'} onChange={e => setImportDraft(d => ({ ...d, inputKind: e.target.value as 'source' | 'topic' }))}><option value="source">Source material</option><option value="topic" disabled={!!importDraft.attachments.length}>Topic</option></select></label>
      <div className="build-text"><textarea aria-label="Material text" aria-describedby="build-material-help build-count" placeholder={importDraft.inputKind === 'topic' ? 'For example: Interest Rates, Photosynthesis, Japanese particles' : 'Paste your text here...\nFor example: a ChatGPT conversation, an article, or class notes'} maxLength={MAX_SOURCE_LENGTH} value={importDraft.text} onChange={e => setImportDraft(d => ({ ...d, text: e.target.value }))} /><span id="build-count">{importDraft.text.length.toLocaleString('en-US')} / {MAX_SOURCE_LENGTH.toLocaleString('en-US')}</span></div>
      <input ref={input} type="file" aria-label="Upload learning files" accept={DOCUMENT_ACCEPT} multiple hidden disabled={reading || importDraft.attachments.length >= MAX_ATTACHMENTS} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void upload(files); }} />
      <button className="build-upload" type="button" disabled={reading || importDraft.attachments.length >= MAX_ATTACHMENTS} onClick={() => input.current?.click()}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9a4 4 0 0 1 6 6l-8 8a2 2 0 0 1-3-3l7-7" /></svg>Upload files</button>
      <p className="build-formats">{DOCUMENT_ACCEPT.split(',').join(' · ')}<br />Up to {MAX_DOCUMENT_BYTES / 1024 / 1024} MB per file · {MAX_ATTACHMENTS} files maximum</p>
      {uploadError && <p className="build-error" role="alert">{uploadError}</p>}
      {!!importDraft.attachments.length && <ul className="build-files">{importDraft.attachments.map(file => <li key={file.id}>
        <PatchIcon name="document" size={30} /><div><strong>{file.name}</strong><small>{file.size !== undefined ? file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${file.text.length.toLocaleString()} characters`}</small></div>
        <span className="build-file-status" role="status"><span className="sr-only">{file.name}: {file.status === 'reading' ? 'Checking file' : file.status === 'failed' ? 'File not accepted' : 'Accepted for processing'}</span><span aria-hidden="true">{file.status === 'reading' ? '…' : file.status === 'failed' ? '!' : <PatchIcon name="check" size={16} />}</span></span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setImportDraft(d => ({ ...d, attachments: d.attachments.filter(a => a.id !== file.id) }))}><PatchIcon name="close" size={22} /></button>
        {file.error && <p className="build-file-error" role="alert">{file.error}</p>}
      </li>)}</ul>}
      <p id="build-material-help" className="build-helper">{importDraft.inputKind === 'topic' ? 'Enter a topic (1–200 characters). AI uses general knowledge, not an uploaded source.' : 'Use 80–30,000 characters of source material, including files. Text-based PDFs only (up to 200 pages).'}</p>
      <p className="build-helper">AI processing limits may require a shorter excerpt, especially for multibyte text.</p>
      {!!source.length && invalid && !reading && <p className="build-error" role="status">{invalid}</p>}
      {!!importDraft.attachments.length && <p className="build-helper">Combined material: {source.length.toLocaleString('en-US')} / 30,000 characters</p>}
    </section>}
    {step === 3 && <section className="build-content build-customize">
      <h1 ref={heading} tabIndex={-1}>Customize learning</h1>
      {hasMaterial && <fieldset className="build-coverage"><legend>Coverage</legend>
        <label className={`build-choice ${build.coverage === 'whole' ? 'selected' : ''}`}><input type="radio" name="coverage" checked={build.coverage === 'whole'} onChange={() => update({ coverage: 'whole' })} /><Radio selected={build.coverage === 'whole'} /><strong>Whole material</strong></label>
        <div className={`build-focus ${build.coverage === 'focus' ? 'selected' : ''}`}><label className="build-choice"><input type="radio" name="coverage" checked={build.coverage === 'focus'} onChange={() => update({ coverage: 'focus' })} /><Radio selected={build.coverage === 'focus'} /><span><strong>Focus on something specific</strong>{build.coverage === 'focus' && <small>Tell Patch what you want to concentrate on.</small>}</span></label>
          {build.coverage === 'focus' && <div className="build-focus-field"><label htmlFor="build-focus">Your focus</label><textarea id="build-focus" value={build.focus} maxLength={MAX_FOCUS_LENGTH} aria-invalid={focusInvalid} aria-describedby={focusInvalid ? 'build-focus-error' : undefined} onChange={e => update({ focus: e.target.value })} />{focusInvalid && <p id="build-focus-error" className="build-error">Enter what you want to focus on.</p>}</div>}
        </div>
        {build.coverage === 'whole' && <p className="build-helper">Cover the main ideas throughout your material.</p>}
      </fieldset>}
      <fieldset className="build-detail"><legend>Level of detail</legend><div>{[['要点のみ', 'Key points', 'Essentials'], ['標準', 'Standard', 'Balanced'], ['詳しく', 'Detailed', 'In-depth']].map(([value, title, subtitle]) => <label key={value} className={`build-choice ${importDraft.detail === value ? 'selected' : ''}`}><input type="radio" name="detail" checked={importDraft.detail === value} onChange={() => setImportDraft(d => ({ ...d, detail: value }))} /><Radio selected={importDraft.detail === value} /><span><strong>{title}</strong><small>{subtitle}</small></span></label>)}</div></fieldset>
      <fieldset className="build-format"><legend>Study format</legend><div>{[['一問一答', 'Flashcards', 'Recall the answer'], ['4択問題', 'Multiple choice', 'Choose an answer']].map(([value, title, subtitle]) => <label key={value} className={`build-choice ${importDraft.style === value ? 'selected' : ''}`}><input type="radio" name="format" checked={importDraft.style === value} onChange={() => setImportDraft(d => ({ ...d, style: value }))} /><Radio selected={importDraft.style === value} /><span><strong>{title}</strong><small>{subtitle}</small></span></label>)}</div></fieldset>
      {invalid && <p className="build-error" role="alert">{invalid}</p>}
      {!formatValid && <p className="build-error" role="alert">Choose Flashcards or Multiple choice to continue with this saved draft.</p>}
      {!destinationValid && <p className="build-error" role="alert">Choose an available Patch in Step 1.</p>}
    </section>}
    {step === 'preparing' && <section className="build-preparing">
      <Mascot pose="finding" /><h1 ref={heading} tabIndex={-1}>{generationRunning ? 'Preparing your Patch...' : build.generation.outcome === 'final' ? 'Generation didn’t finish' : 'Let’s finish your Patch'}</h1>
      {generationRunning ? <div role="status"><p>This may take a moment.</p><span className="build-dots" aria-hidden="true"><i /><i /><i /></span></div> : <div><p role="alert">{build.generation.error || 'Your material is saved. Retry to check your interrupted request.'}</p><button type="button" className="build-primary" onClick={generate}>{build.generation.outcome === 'final' ? 'Generate again' : 'Retry'}</button><button type="button" className="build-return" onClick={() => update({ step: 3 })}>Back to Customize learning</button></div>}
    </section>}
    {step === 'review' && review}
    {typeof step === 'number' && <div className="build-actions"><button type="button" className="build-primary" disabled={step === 1 ? !destinationValid : step === 2 ? !!invalid : !!invalid || focusInvalid || !destinationValid || !formatValid || generationRunning} onClick={() => step === 3 ? generate() : update({ step: step === 1 ? 2 : 3 })}>{step === 3 ? 'Generate Patch' : 'Continue'}</button></div>}
  </div>;
}
