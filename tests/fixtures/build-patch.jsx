// Isolated development fixture. Never imported by Web or native entrypoints.
import React, { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ImportScreen } from '../../app/build-patch';
import { useWorkspace } from '../../app/use-workspace';
import { useBuildGeneration } from '../../app/use-build-generation';
import { Shell, Generate } from '../../app/page'; // Test-only Vite export.
import { AccountContext } from '../../app/account-context';
import { LanguageProvider } from '../../app/language';
import { normalizeBuildDraft } from '../../lib/build-draft';
import '../../app/globals.css';
import '../../mobile/fonts.css';
const params = new URL(location.href).searchParams;
const sets = ['Economics Basics', 'Japanese Grammar', 'Marketing Analytics'].map((title, i) => ({ id: 's' + i, title, cards: [], folderId: null }));
const data = { sets, folders: [] };
const fixture = window.buildFixture = { requests: [], pending: [], mode: 'hold', saves: 0 };
const account = { scope: { account: { userId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' }, isCurrent: () => true, request: async () => Response.json({}) }, logout: async () => {} };
const result = { title: 'Recall and practice', category: 'Learning', summary: 'A generated summary.', keyPoints: ['Recall strengthens memory.'], cards: [{ question: 'What supports memory?', answer: 'Recall', choices: [], format: 'qa', difficulty: 1 }] };
const api = async (url, options) => {
  fixture.requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
  return new Promise((resolve, reject) => fixture.pending.push({ resolve: () => resolve(result), reject: () => reject(Object.assign(new Error('Connection interrupted'), { code: 'AI_UNKNOWN' })) }));
};
function Flow() {
  const { workspace, getWorkspace, setWorkspace, workspaceReady } = useWorkspace();
  const generation = useBuildGeneration(getWorkspace, setWorkspace, api, 'en');
  const [screen, setScreen] = useState('import');
  const [patches, setPatches] = useState(data);
  const [listState, setListState] = useState('ready');
  useEffect(() => {
    fixture.getWorkspace = getWorkspace;
    fixture.update = setWorkspace;
    fixture.setScreen = setScreen;
    fixture.setPatches = setPatches;
    fixture.setListState = setListState;
    fixture.run = generation.run;
    fixture.ready = workspaceReady;
  }, [getWorkspace, setWorkspace, generation.run, workspaceReady]);
  const setImportDraft = value => setWorkspace(w => ({ ...w, importDraft: typeof value === 'function' ? value(w.importDraft) : value }));
  const setDestination = destination => setWorkspace(w => ({ ...w, destination }));
  if (!workspaceReady) return <p>Loading test workspace</p>;
  const build = normalizeBuildDraft(workspace.importDraft.build, workspace.destination);
  return <Shell screen={screen} setScreen={setScreen} buildStep={build.step}>{screen === 'import' ? <ImportScreen data={patches} destination={workspace.destination} setDestination={setDestination} importDraft={workspace.importDraft} setImportDraft={setImportDraft} generationRunning={generation.isRunning()} onGenerate={() => generation.run()} patchesLoading={listState === 'loading'} patchesError={listState === 'error' ? 'failed' : ''} onRetryPatches={() => setListState('ready')} review={<Generate data={data} draft={workspace.draft} setDraft={draft => setWorkspace(w => ({ ...w, draft }))} destination={workspace.destination} setDestination={setDestination} onSave={async () => { fixture.saves++; }} onRegenerate={() => generation.run(true)} />} /> : <button onClick={() => setScreen('import')}>Return to draft</button>}</Shell>;
}
function Harness() {
  const [key, setKey] = useState(0);
  useEffect(() => { fixture.remount = () => setKey(k => k + 1); }, []);
  return <AccountContext.Provider value={account}><LanguageProvider initialLanguage={params.get('lang') || 'en'}><Flow key={key} /></LanguageProvider></AccountContext.Provider>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Harness /></StrictMode>);
