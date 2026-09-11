"use client";

import { useApiFetch, useAccount } from "./account-context";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../lib/types';
import { GOALS, INTEREST_GROUPS, recommend } from '../lib/onboarding';
import { useLanguage } from './language';
import { AssetIcon } from './asset-icon';

export function Onboarding({data,onData,onStart,onFinish,study}: {data: AppData; onData:(data:AppData)=>void;onStart:()=>void;onFinish:()=>void;study:ReactNode}) {
  const apiFetch = useApiFetch();
  const account = useAccount();
  const profile = data.profile!;
  const {t} = useLanguage();
  const [step,setStep] = useState(profile.initialSetId ? 'intro' : profile.learningGoal ? 'recommend' : profile.interests.length === 3 ? 'goal' : profile.displayName ? 'interests' : 'name');
  const [name,setName] = useState(profile.displayName);
  const [interests,setInterests] = useState(profile.interests);
  const [goal,setGoal] = useState(profile.learningGoal);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();window.scrollTo(0,0);},[step,profile.firstLearningCompletedAt]);
  async function save(input:Record<string,unknown>,next:string) {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try {
      const response = await apiFetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'onboarding',...input})});
      const result = await response.json() as { data: AppData; error?: string };
      if(!response.ok)throw new Error(result.error || t('保存できませんでした。もう一度お試しください。'));
      onData(result.data);setStep(next);
      if(input.step==='finish')onFinish();
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{lock.current=false;setBusy(false);}
  }
  const complete = Boolean(profile.firstLearningCompletedAt);
  const selected = data.sets.find(s=>s.id===profile.initialSetId);
  const recommendations = recommend(profile.interests,profile.learningGoal);
  const title = complete ? '最初の学習、完了！' : step==='name' ? 'なんとお呼びすればいいですか？' : step==='interests' ? '何に興味がありますか？' : step==='goal' ? 'どんな目的で学びたいですか？' : step==='recommend' ? 'あなたに合いそうな3つを選びました' : selected?.title || '';
  return <div className="onboarding-shell">
    <header className="onboarding-brand">Patch <span>{t('はじめの一歩')}</span></header>
    {study && !complete ? <main>{study}</main> : <main className="onboarding-page">
      {!complete && ['interests','goal','recommend'].includes(step) && <button className="onboarding-back" disabled={busy} onClick={()=>{setError('');setStep(step==='interests'?'name':step==='goal'?'interests':'goal');}}>{t('戻る')}</button>}
      {account && <button type="button" onClick={() => void account.logout()}>ログアウト</button>}<h1 ref={heading} tabIndex={-1}>{t(title)}</h1>
      {complete ? <section className="onboarding-success">
        <div className="onboarding-streak"><AssetIcon name="streak" size={52}/><strong>{t('1日')}</strong></div>
        <h2>{t('連続学習がスタートしました')}</h2><p>{t('3枚学習しました')}</p><p className="muted">{t('最初のPatchができました')}</p>
        <button className="primary wide" disabled={busy} onClick={()=>save({step:'finish'},'done')}>{t('ホームへ')}</button>
      </section> : step==='name' ? <form onSubmit={e=>{e.preventDefault();void save({step:'name',displayName:name},'interests');}}>
        <p className="muted">{t('あなたに合った学びをおすすめします。')}</p><label className="onboarding-name">{t('名前')}<input autoComplete="given-name" maxLength={60} value={name} onChange={e=>setName(e.target.value)} required /></label>
        <button className="primary wide" disabled={busy||!name.trim()}>{t('次へ')}</button>
      </form> : step==='interests' ? <>
        <p className="muted">{t('気になるものを3つ選んでください。')}</p>
        {Object.entries(INTEREST_GROUPS).map(([group,items])=><fieldset className="onboarding-interests" key={group}><legend>{t(group)}</legend><div>{items.map(item=><button key={item} type="button" aria-pressed={interests.includes(item)} disabled={busy||(!interests.includes(item)&&interests.length===3)} onClick={()=>setInterests(current=>current.includes(item)?current.filter(i=>i!==item):current.length<3?[...current,item]:current)}>{t(item)}</button>)}</div></fieldset>)}
        <footer className="onboarding-footer"><span aria-live="polite">{interests.length} / 3</span><button className="primary" disabled={busy||interests.length!==3} onClick={()=>save({step:'interests',interests},'goal')}>{t('次へ')}</button><small>{t('選択済みの項目は、もう一度押すと解除できます。')}</small></footer>
      </> : step==='goal' ? <>
        <p className="muted">{t('今のあなたに一番近いものを選んでください。')}</p><div className="onboarding-options" role="group" aria-label={t('学習目的')}>{GOALS.map(item=><button className="onboarding-option" key={item} aria-pressed={goal===item} disabled={busy} onClick={()=>setGoal(item)}>{t(item)}</button>)}</div>
        <button className="primary wide" disabled={busy||!GOALS.includes(goal)} onClick={()=>save({step:'goal',learningGoal:goal},'recommend')}>{t('次へ')}</button>
      </> : step==='recommend' ? <>
        <p className="muted">{t('まずは気になるものから始めてみましょう。')}</p><div className="onboarding-options">{recommendations.map(({preset,reason})=><button key={preset.id} className="onboarding-preset" disabled={busy} onClick={()=>save({step:'select',presetId:preset.id},'intro')}><strong>{t(preset.title)}</strong><span>{t(preset.summary)}</span><small>{t('約5分')} · {preset.cards.length}{t('枚')} · {t('入門')}</small><span className="onboarding-reason">{t(reason)}</span></button>)}</div>
      </> : selected ? <section className="onboarding-intro"><p>{t(selected.summary)}</p><p className="muted">{t('約5分')} · {selected.cards.length}{t('枚')} · {t('入門')}</p><h2>{t('このセットで分かること')}</h2><ul>{selected.keyPoints.map(point=><li key={point}>{t(point)}</li>)}</ul><button className="primary wide" onClick={onStart}>{t('まず3枚やってみる')}</button><p className="muted onboarding-time">{t('約2分で終わります')}</p></section> : null}
      {busy && <p role="status">{t('保存しています…')}</p>}{error && <p className="inline-error" role="alert">{t(error)}</p>}
    </main>}
  </div>;
}
