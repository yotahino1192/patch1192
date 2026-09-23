"use client";
import { useRef, useState } from 'react';
import type { AppData } from '../lib/types';
import type { DraftMaterial, ImportDraft } from '../lib/workspace';
import { normalizeBuildDraft } from '../lib/build-draft';
import { reviewError, type SavedMaterial } from '../lib/material-save';
import { Dropdown } from './dropdown';
import { PatchIcon, type PatchIconName } from './patch-ui';
import { useLanguage } from './language';
import { localizeBuildError } from './build-copy';
import { Mascot } from './mascot';

function StudyPreview({ draft }: { draft: DraftMaterial }) {
  const { t } = useLanguage();
  const cards = draft.cards.filter(c => c.selected);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const index = Math.min(position, Math.max(0, cards.length - 1));
  const card = cards[index];
  if (!card) return null;
  if (card.format !== 'qa' && card.format !== 'multiple_choice') return <p className="build-error" role="alert">{t("この下書きの形式は現在利用できません。戻ってフラッシュカードか選択問題を選んでください。")}</p>;
  const move = (delta: number) => { setPosition(index + delta); setRevealed(false); };
  return <section className="build-study-preview" aria-labelledby="study-preview-title">
    <h2 id="study-preview-title">{t("プレビュー")}</h2>
    <div className="build-preview-card">
      <span className="build-preview-kind">{card.format === 'multiple_choice' ? t("選択問題") : t("フラッシュカード")}</span>
      <p className="build-preview-question">{card.question}</p>
      {card.format === 'multiple_choice' && <ol className="build-preview-options" aria-label={t("回答の選択肢")}>{card.choices.map((choice, i) => <li key={i}><span aria-hidden="true">{String.fromCharCode(65 + i)}</span>{choice}</li>)}</ol>}
      <button type="button" className="build-reveal" aria-expanded={revealed} aria-controls="build-preview-answer" onClick={() => setRevealed(!revealed)}>{revealed ? t("答えを隠す") : t("答えを表示")}</button>
      {revealed && <p id="build-preview-answer" className="build-preview-answer">{card.answer}</p>}
      <div className="build-preview-navigation"><button type="button" aria-label={t("前のプレビュー")} disabled={index === 0} onClick={() => move(-1)}><PatchIcon name="chevron" /></button><span aria-live="polite">{t("{1}枚中{0}枚目", index + 1, cards.length)}</span><button type="button" aria-label={t("次のプレビュー")} disabled={index === cards.length - 1} onClick={() => move(1)}><PatchIcon name="chevron" /></button></div>
    </div>
  </section>;
}

export function BuildReview({ draft, importDraft, data, destination, setDestination, setDraft, onSave, saving, pendingSave, error }: {
  draft: DraftMaterial | null; importDraft: ImportDraft; data: AppData; destination: string;
  setDestination: (value: string) => void; setDraft: (draft: DraftMaterial) => void;
  onSave: () => Promise<void>; saving: boolean; pendingSave: boolean; error: string;
}) {
  const { t } = useLanguage();
  const name = useRef<HTMLInputElement>(null);
  const build = normalizeBuildDraft(importDraft.build, destination);
  const existing = destination.startsWith('set:');
  const set = data.sets.find(s => s.id === destination.slice(4));
  const invalid = draft?.cards.some(c => c.format !== 'qa' && c.format !== 'multiple_choice') ? t("戻ってフラッシュカードか選択問題として生成してください。") : reviewError(draft, destination, data.sets.map(s => s.id));
  const locked = saving || pendingSave;
  const icons: PatchIconName[] = ['book', 'bars', 'arrow', 'document'];
  return <section className="build-review">
    <div className="build-review-intro">{draft?.sourceKind === 'topic' && <p>{t("入力したトピックをもとに、一般知識を使って生成しました。")}</p>}<h1>{t("内容を確認しましょう")}</h1><p>{t("パッチの概要です。")}</p></div>
    {draft && <>
      <div className="build-review-name"><label htmlFor="build-patch-name">{t("パッチ名")}</label>{existing ? <p className="build-existing-name">{set?.title || t("利用できないパッチ")}</p> : <div><input ref={name} id="build-patch-name" value={draft.title} maxLength={120} disabled={locked} onChange={e => setDraft({ ...draft, title: e.target.value })} aria-invalid={!draft.title.trim()} /><button type="button" aria-label={t("パッチ名を編集")} disabled={locked} onClick={() => name.current?.focus()}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 15 11-11 5 5L9 20l-6 1 1-6Zm10-10 5 5M16 3l2-2 5 5-2 2" /></svg></button></div>}</div>
      <Dropdown label={t("保存先")} value={existing ? destination : 'root'} disabled={locked} onChange={setDestination} className="build-review-destination" options={[
        { value: 'root', label: t("新しいパッチ"), menuLabel: t("新しいパッチを作成") },
        ...(!set && existing ? [{ value: destination, label: t("利用できないパッチ"), group: t("既存のパッチ") }] : []),
        ...data.sets.map(s => ({ value: `set:${s.id}`, label: s.title, group: t("既存のパッチ") })),
      ]} />
      {!data.sets.length && <p className="build-helper">{t("既存のパッチはまだありません。")}</p>}
      <section className="build-outcomes"><h2>{t("学ぶ内容")}</h2><ul>{draft.keyPoints.filter(p => p.trim()).map((point, index) => <li key={index}><span><PatchIcon name={icons[index % icons.length]} size={20} /></span><p>{point}</p></li>)}</ul></section>
      <StudyPreview key={draft.cards.map(c => c.draftId).join(':')} draft={draft} />
      <section className="build-review-preferences"><h2>{t("学習設定")}</h2><ul><li><PatchIcon name="book" size={19} />{build.coverage === 'focus' ? t("重点的に学ぶ") : t("教材全体")}</li><li><PatchIcon name="bars" size={19} />{{ '要点のみ': t("要点のみ"), '標準': t("標準"), '詳しく': t("詳しく") }[importDraft.detail] || importDraft.detail}</li><li><PatchIcon name="document" size={19} />{importDraft.style === '4択問題' ? t("選択問題") : t("フラッシュカード")}</li></ul>{build.coverage === 'focus' && <p className="build-review-focus"><strong>{t("重点的に学ぶ内容")}</strong>{build.focus}</p>}</section>
    </>}
    {invalid && <p className="build-error" role="alert">{localizeBuildError(invalid, t)}</p>}
    {error && <p className="build-error" role="alert">{localizeBuildError(error, t)}</p>}
    {pendingSave && !saving && <p className="build-helper">{t("変更する前に、保留中の保存を再試行してください。")}</p>}
    <div className="build-actions"><button type="button" className="build-primary" disabled={saving || (!pendingSave && !!invalid)} aria-busy={saving} onClick={() => void onSave()}>{saving ? t("保存中…") : pendingSave ? t("保存を再試行") : existing ? t("パッチに追加") : t("パッチを作成")}</button></div>
  </section>;
}

export function PatchReady({ saved, onStart, onHome }: { saved: SavedMaterial; onStart: () => Promise<void>; onHome: () => void }) {
  const { t, language } = useLanguage();
  const lock = useRef(false);
  const [starting, setStarting] = useState(false), [error, setError] = useState('');
  const start = async () => {
    if (lock.current) return;
    lock.current = true; setStarting(true); setError('');
    try { await onStart(); } catch { setError("レッスンを開始できませんでした。パッチは保存済みです。もう一度お試しください。"); }
    finally { lock.current = false; setStarting(false); }
  };
  return <section className="build-flow build-ready" lang={language}>
    <Mascot pose="sparkling" /><h1>{t(saved.appended ? "パッチを更新しました。" : "パッチができました。")}</h1>
    <p>{t(saved.appended ? "新しい教材の保存先：" : "学習内容の保存先：")} <strong>{saved.title}</strong>{t("学習を始める準備ができました！")}</p>
    <button type="button" className="build-primary" disabled={starting} aria-busy={starting} onClick={() => void start()}>{starting ? t("レッスンを開始しています…") : t("レッスンを始める")}</button>
    <button type="button" className="build-ready-home" disabled={starting} onClick={onHome}>{t("ホームへ")}</button>
    {error && <p className="build-error" role="alert">{localizeBuildError(error, t)}</p>}
    <aside className="build-ready-quote"><span aria-hidden="true">“</span><p>{t("小さな一歩が、大きな成長に。")}</p><svg viewBox="0 0 52 62" width="52" height="62" aria-hidden="true"><path d="M28 57Q33 39 20 24" fill="none" stroke="#246454" strokeWidth="3" /><path d="M29 45C9 44 8 30 8 30c16-2 22 3 21 15" fill="#55bc98" /><path d="M30 49c1-16 16-17 16-17 4 14-4 19-16 17" fill="#2d977a" /><path d="m32 19 5-10m4 17 7-3" stroke="#e7b65c" strokeWidth="4" strokeLinecap="round" /></svg></aside>
  </section>;
}
