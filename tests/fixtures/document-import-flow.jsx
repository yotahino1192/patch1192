// Isolated synthetic QA only. Never imported by application entrypoints.
import './build-patch.jsx';
import { documentFixtures, fixtureText, normalizedText } from './document-files.mjs';
// LAN HTTP Safari lacks secure-context randomUUID. Only this fixture supplies it.
if (!crypto.randomUUID) crypto.randomUUID = () => '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));
const pause = () => new Promise(resolve => setTimeout(resolve, 50));
async function until(check) { for (let i = 0; i < 400; i++) { if (check()) return; await pause(); } throw Error('fixture timeout'); }
const results = [];
async function reset() {
  window.buildFixture.update(w => ({ ...w, importDraft: { ...w.importDraft, text: '', inputKind: 'source', attachments: [], build: { ...w.importDraft.build, step: 2 } } }));
  await pause();
}
async function select(files) {
  const transfer = new DataTransfer(); files.forEach(file => transfer.items.add(file));
  const input = document.querySelector('input[type=file]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  await pause(); await until(() => window.buildFixture.getWorkspace().importDraft.attachments.every(a => a.status !== 'reading'));
}
const canContinue = () => !document.querySelector('.build-primary').disabled;
try {
  await until(() => window.buildFixture?.ready);
  for (const [format, data] of Object.entries(documentFixtures)) {
    await reset(); await select([new File([data], 'safe.' + format)]);
    const attachment = window.buildFixture.getWorkspace().importDraft.attachments[0];
    const accepted = attachment?.status === 'accepted', textMatches = normalizedText(attachment?.text || '') === fixtureText, enabled = canContinue();
    if (enabled) { document.querySelector('.build-primary').click(); await pause(); }
    const continued = window.buildFixture.getWorkspace().importDraft.build.step === 3;
    await reset(); await select([new File([['pdf','docx','pptx'].includes(format) ? 'not a valid document' : ''], 'broken.' + format)]);
    const rejected = window.buildFixture.getWorkspace().importDraft.attachments[0]?.status === 'failed' && !canContinue();
    results.push({ format, accepted, textMatches, canContinue: enabled, continued, malformedRejected: rejected });
  }
  await reset(); await select([new File([fixtureText], 'unsupported.doc')]);
  results.push({ check: 'unsupported', ok: window.buildFixture.getWorkspace().importDraft.attachments[0]?.status === 'failed' });
  await reset(); await select([new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'oversize.txt')]);
  results.push({ check: '10MiB+1 rejected', ok: window.buildFixture.getWorkspace().importDraft.attachments[0]?.status === 'failed' && !canContinue() });
  await reset(); await select(Array.from({ length: 5 }, (_, i) => new File([fixtureText], `safe-${i}.txt`)));
  results.push({ check: '5 accepted', ok: window.buildFixture.getWorkspace().importDraft.attachments.length === 5 && canContinue() && document.querySelector('input[type=file]').disabled });
  await reset(); await select(Array.from({ length: 6 }, (_, i) => new File([fixtureText], `safe-${i}.txt`)));
  results.push({ check: '6 rejected', ok: window.buildFixture.getWorkspace().importDraft.attachments.length === 0 && !canContinue() });
  await reset(); await select([new File(['A'.repeat(16000)], 'a.txt'),new File(['B'.repeat(16000)], 'b.txt')]);
  results.push({ check: 'combined 30000 limit', ok: !canContinue() && window.buildFixture.getWorkspace().importDraft.attachments.every(a => a.status === 'accepted') });
  results.push({ check: 'zero AI calls', ok: window.buildFixture.requests.length === 0 });
} catch (error) { results.push({ check: 'harness', ok: false, error: error.message }); }
window.importResults = results;
const report = { selection: 'synthetic File/DataTransfer into real ImportScreen (not native Files picker)', userAgent: navigator.userAgent, streamIterator: typeof ReadableStream.prototype[Symbol.asyncIterator], results };
document.body.innerHTML = '<pre id="result"></pre>'; document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
window.webkit?.messageHandlers?.results?.postMessage(JSON.stringify(report));
fetch('/qa-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) }).catch(() => {});
