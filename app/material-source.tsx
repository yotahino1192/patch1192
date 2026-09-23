"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { useApiFetch } from './account-context';
import { useLanguage } from './language';
import { readMaterialText } from '../lib/material-data-client';
import type { CardSet } from '../lib/types';

function MaterialText({ set, field, prefix }: { set: CardSet; field: 'source' | 'keyPoints'; prefix?: ReactNode }) {
  const request = useApiFetch(), { t } = useLanguage();
  const [content, setContent] = useState<string | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const id = set.id, revision = set.sourceUpdatedAt ?? set.updatedAt;
  useEffect(() => {
    let current = true;
    void readMaterialText(request, { id, updatedAt: revision }, field).then(value => { if (current) setContent(value); }, () => { if (current) setError('学習データを読み込めませんでした。'); });
    return () => { current = false; };
  }, [request, id, revision, field, attempt]); // Revision invalidates cached source after append.
  if (error) return <div role="alert"><p>{t(error)}</p><button type="button" className="secondary" onClick={() => { setContent(null); setError(''); setAttempt(value => value + 1); }}>{t('再試行')}</button></div>;
  if (content === null) return <p role="status">{t('学習データを準備しています…')}</p>;
  if (field === 'keyPoints') {
    let points: string[] = [];
    try { points = JSON.parse(content); if (!Array.isArray(points) || !points.every(point => typeof point === 'string')) throw Error(); } catch { return <p role="alert">{t('学習データを読み込めませんでした。')}</p>; }
    return <ul>{points.map((point, index) => <li key={index}>{t(point)}</li>)}</ul>;
  }
  return <p>{prefix}{content}</p>;
}
export function MaterialSource({ set, label, prefix }: { set: CardSet; label: ReactNode; prefix?: ReactNode }) {
  const [opened, setOpened] = useState(false);
  return <details className="source-details" onToggle={event => setOpened(event.currentTarget.open)}><summary>{label}</summary>{opened && <MaterialText key={`${set.id}:${set.sourceUpdatedAt ?? set.updatedAt}`} set={set} field="source" prefix={prefix} />}</details>;
}
export function MaterialKeyPoints({ set }: { set: CardSet }) {
  return <MaterialText key={`${set.id}:${set.sourceUpdatedAt ?? set.updatedAt}`} set={set} field="keyPoints" />;
}
