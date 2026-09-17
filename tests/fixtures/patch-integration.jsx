// Real App/providers; only native identity and controlled transport failures are fixtures.
import { createRoot } from 'react-dom/client';
import Patch from '../../app/page';
import { configureNativeAuth } from '../../lib/auth-platform';
import '../../app/globals.css';
import '../../mobile/fonts.css';

const config = await (await fetch('/__lesson_identity')).json();
let who = 'A';
const listeners = new Set();
const fixture = window.integrationFixture = { writes: [], failComplete: false, lose: false, fail: false, helpCalls: 0, helpDelay: 0, listDelay: 0, failList: false };
const startupTest = new URLSearchParams(location.search).has('startup');
const heldStartup = new Map(), visitedStartup = new Set();
fixture.releaseStartup = phase => heldStartup.get(phase)?.();
const waitStartup = async phase => {
  if (!startupTest || visitedStartup.has(phase)) return;
  visitedStartup.add(phase); fixture.startupPhase = phase;
  await new Promise(resolve => heldStartup.set(phase, resolve));
};
const originalFetch = window.fetch.bind(window);
window.fetch = async (path, options) => {
  const url = String(path);
  if (url === '/api/auth/session') await waitStartup('account');
  if (url === '/api/data') await waitStartup('data');
  if (url.includes('/api/domain') && fixture.fail) throw Error('test offline');
  if (url.includes('resource=patches') && fixture.failList) throw Error('test list offline');
  if (fixture.failComplete && options?.body?.includes('completeLesson')) throw Error('complete unavailable');
  if (url.includes('/api/ai/chat')) { fixture.helpCalls++; await new Promise(r => setTimeout(r, fixture.helpDelay)); return Response.json({ answer: 'Integration test explanation' }); }
  if (options?.method === 'POST' && url.includes('/api/domain')) fixture.writes.push(JSON.parse(options.body));
  const result = await originalFetch(path, options);
  if (fixture.lose && options?.body?.includes('recordAttempt')) { fixture.lose = false; throw Error('lost response'); }
  if (url.includes('resource=patches')) await new Promise(r => setTimeout(r, fixture.listDelay));
  return result;
};
const identity = () => who ? config[who].identity : null;
fixture.switchAccount = value => { who = value; for (const listener of listeners) listener(identity()); };
configureNativeAuth({
  initialize: async () => { await waitStartup('session'); return identity(); }, getSession: async () => identity(),
  getToken: async () => (await (await originalFetch('/__lesson_identity')).json())[who].token,
  subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  startEmail: async () => {}, verifyEmail: async () => identity(), signOut: async () => fixture.switchAccount(null),
});
createRoot(document.getElementById('root')).render(<Patch />);
