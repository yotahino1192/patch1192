"use client";
import { useRef, useState } from 'react';
import type { AppData } from '../lib/types';
import type { DraftMaterial, ImportDraft } from '../lib/workspace';
import { normalizeBuildDraft } from '../lib/build-draft';
import { reviewError, type SavedMaterial } from '../lib/material-save';
import { Dropdown } from './dropdown';
import { PatchIcon, type PatchIconName } from './patch-ui';
import { Mascot } from './mascot';

function StudyPreview({ draft }: { draft: DraftMaterial }) {
  const cards = draft.cards.filter(c => c.selected);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const index = Math.min(position, Math.max(0, cards.length - 1));
  const card = cards[index];
  if (!card) return null;
  if (card.format !== 'qa' && card.format !== 'multiple_choice') return <p className="build-error" role="alert">This saved draft uses a format that is not available in this version. Go back and choose Flashcards or Multiple choice.</p>;
  const move = (delta: number) => { setPosition(index + delta); setRevealed(false); };
  return <section className="build-study-preview" aria-labelledby="study-preview-title">
    <h2 id="study-preview-title">Preview</h2>
    <div className="build-preview-card">
      <span className="build-preview-kind">{card.format === 'multiple_choice' ? 'Multiple choice' : 'Flashcard'}</span>
      <p className="build-preview-question">{card.question}</p>
      {card.format === 'multiple_choice' && <ol className="build-preview-options" aria-label="Answer options">{card.choices.map((choice, i) => <li key={i}><span aria-hidden="true">{String.fromCharCode(65 + i)}</span>{choice}</li>)}</ol>}
      <button type="button" className="build-reveal" aria-expanded={revealed} aria-controls="build-preview-answer" onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide answer' : 'Show answer'}</button>
      {revealed && <p id="build-preview-answer" className="build-preview-answer">{card.answer}</p>}
      <div className="build-preview-navigation"><button type="button" aria-label="Previous preview" disabled={index === 0} onClick={() => move(-1)}><PatchIcon name="chevron" /></button><span aria-live="polite">{index + 1} of {cards.length}</span><button type="button" aria-label="Next preview" disabled={index === cards.length - 1} onClick={() => move(1)}><PatchIcon name="chevron" /></button></div>
    </div>
  </section>;
}

export function BuildReview({ draft, importDraft, data, destination, setDestination, setDraft, onSave, saving, pendingSave, error }: {
  draft: DraftMaterial | null; importDraft: ImportDraft; data: AppData; destination: string;
  setDestination: (value: string) => void; setDraft: (draft: DraftMaterial) => void;
  onSave: () => Promise<void>; saving: boolean; pendingSave: boolean; error: string;
}) {
  const name = useRef<HTMLInputElement>(null);
  const build = normalizeBuildDraft(importDraft.build, destination);
  const existing = destination.startsWith('set:');
  const set = data.sets.find(s => s.id === destination.slice(4));
  const invalid = draft?.cards.some(c => c.format !== 'qa' && c.format !== 'multiple_choice') ? 'Go back and generate this draft as Flashcards or Multiple choice.' : reviewError(draft, destination, data.sets.map(s => s.id));
  const locked = saving || pendingSave;
  const icons: PatchIconName[] = ['book', 'bars', 'arrow', 'document'];
  return <section className="build-review">
    <div className="build-review-intro"><h1>Looks good!</h1><p>Here&apos;s a summary of your Patch.</p></div>
    {draft && <>
      <div className="build-review-name"><label htmlFor="build-patch-name">Patch name</label>{existing ? <p className="build-existing-name">{set?.title || 'Unavailable Patch'}</p> : <div><input ref={name} id="build-patch-name" value={draft.title} maxLength={120} disabled={locked} onChange={e => setDraft({ ...draft, title: e.target.value })} aria-invalid={!draft.title.trim()} /><button type="button" aria-label="Edit Patch name" disabled={locked} onClick={() => name.current?.focus()}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 15 11-11 5 5L9 20l-6 1 1-6Zm10-10 5 5M16 3l2-2 5 5-2 2" /></svg></button></div>}</div>
      <Dropdown label="Destination" value={existing ? destination : 'root'} disabled={locked} onChange={setDestination} className="build-review-destination" options={[
        { value: 'root', label: 'New Patch', menuLabel: 'Create a new Patch' },
        ...(!set && existing ? [{ value: destination, label: 'Unavailable Patch', group: 'Existing Patches' }] : []),
        ...data.sets.map(s => ({ value: `set:${s.id}`, label: s.title, group: 'Existing Patches' })),
      ]} />
      {!data.sets.length && <p className="build-helper">No existing Patches yet.</p>}
      <section className="build-outcomes"><h2>What you’ll learn</h2><ul>{draft.keyPoints.filter(p => p.trim()).map((point, index) => <li key={index}><span><PatchIcon name={icons[index % icons.length]} size={20} /></span><p>{point}</p></li>)}</ul></section>
      <StudyPreview key={draft.cards.map(c => c.draftId).join(':')} draft={draft} />
      <section className="build-review-preferences"><h2>Study preferences</h2><ul><li><PatchIcon name="book" size={19} />{build.coverage === 'focus' ? 'Specific focus' : 'Whole material'}</li><li><PatchIcon name="bars" size={19} />{{ '要点のみ': 'Key points', '標準': 'Standard', '詳しく': 'Detailed' }[importDraft.detail] || importDraft.detail}</li><li><PatchIcon name="document" size={19} />{importDraft.style === '4択問題' ? 'Multiple choice' : 'Flashcards'}</li></ul>{build.coverage === 'focus' && <p className="build-review-focus"><strong>Your focus</strong>{build.focus}</p>}</section>
    </>}
    {invalid && <p className="build-error" role="alert">{invalid}</p>}
    {error && <p className="build-error" role="alert">{error}</p>}
    {pendingSave && !saving && <p className="build-helper">Retry the pending save before making changes.</p>}
    <div className="build-actions"><button type="button" className="build-primary" disabled={saving || (!pendingSave && !!invalid)} aria-busy={saving} onClick={() => void onSave()}>{saving ? 'Saving…' : pendingSave ? 'Retry save' : existing ? 'Add to Patch' : 'Create Patch'}</button></div>
  </section>;
}

export function PatchReady({ saved, onStart, onHome }: { saved: SavedMaterial; onStart: () => Promise<void>; onHome: () => void }) {
  const lock = useRef(false);
  const [starting, setStarting] = useState(false), [error, setError] = useState('');
  const start = async () => {
    if (lock.current) return;
    lock.current = true; setStarting(true); setError('');
    try { await onStart(); } catch { setError('We could not start your lesson. Your Patch is saved. Try again.'); }
    finally { lock.current = false; setStarting(false); }
  };
  return <section className="build-flow build-ready" lang="en">
    <Mascot pose="sparkling" /><h1>Your Patch is {saved.appended ? 'updated' : 'ready'}.</h1>
    <p>{saved.appended ? 'Your new material is saved in' : 'Your study content is saved in'} <strong>{saved.title}</strong>. You’re all set to start learning!</p>
    <button type="button" className="build-primary" disabled={starting} aria-busy={starting} onClick={() => void start()}>{starting ? 'Starting your lesson…' : 'Start my lesson'}</button>
    <button type="button" className="build-ready-home" disabled={starting} onClick={onHome}>Go to Home</button>
    {error && <p className="build-error" role="alert">{error}</p>}
    <aside className="build-ready-quote"><span aria-hidden="true">“</span><p>Small steps make<br />big progress.</p><svg viewBox="0 0 52 62" width="52" height="62" aria-hidden="true"><path d="M28 57Q33 39 20 24" fill="none" stroke="#246454" strokeWidth="3" /><path d="M29 45C9 44 8 30 8 30c16-2 22 3 21 15" fill="#55bc98" /><path d="M30 49c1-16 16-17 16-17 4 14-4 19-16 17" fill="#2d977a" /><path d="m32 19 5-10m4 17 7-3" stroke="#e7b65c" strokeWidth="4" strokeLinecap="round" /></svg></aside>
  </section>;
}
