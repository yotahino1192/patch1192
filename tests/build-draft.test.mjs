import test from 'node:test';
import assert from 'node:assert/strict';
import { materialSource, materialError, generationInput, normalizeBuildDraft } from '../lib/build-draft.ts';
import { EMPTY_IMPORT, EMPTY_WORKSPACE, parseWorkspace } from '../lib/workspace.ts';
const source = 'Source material explaining how recall and spaced practice help learners remember ideas. '.repeat(2);
test('material validation accepts text, accepted files and both, but not whitespace or pending files', () => {
  assert.ok(materialError({ ...EMPTY_IMPORT, text: '  \n ' }));
  assert.ok(materialError({ ...EMPTY_IMPORT, text: 'Short topic' }));
  assert.equal(materialError({ ...EMPTY_IMPORT, text: source }), '');
  const file = { id: 'f', name: 'notes.txt', text: source, status: 'accepted' };
  assert.equal(materialError({ ...EMPTY_IMPORT, attachments: [file] }), '');
  assert.equal(materialSource({ ...EMPTY_IMPORT, text: 'Extra text', attachments: [file] }), 'Extra text\n\n' + source.trim());
  assert.ok(materialError({ ...EMPTY_IMPORT, text: source, attachments: [{ ...file, status: 'reading' }] }));
  assert.equal(materialError({ ...EMPTY_IMPORT, text: source, attachments: [{ ...file, status: 'failed' }] }), '');
  assert.ok(materialError({ ...EMPTY_IMPORT, text: 'a'.repeat(29999), attachments: [file] }));
});
test('inactive focus is preserved locally but never sent; active focus and selected format are sent', () => {
  const draft = { ...EMPTY_IMPORT, text: source, style: '4択問題', detail: '詳しく', build: { ...normalizeBuildDraft(), focus: 'spaced practice' } };
  assert.equal(generationInput(draft, 'en').focus, undefined);
  draft.build.coverage = 'focus';
  assert.deepEqual(generationInput(draft, 'en'), { text: source.trim(), detail: '詳しく', style: '4択問題', language: 'en', focus: 'spaced practice' });
  draft.build.focus = '   ';
  assert.throws(() => generationInput(draft, 'en'), /focus/);
});
test('workspace reload retains all build preferences, selected destination, operation identity and result', () => {
  const w = { ...EMPTY_WORKSPACE, destination: 'set:abc', importDraft: { ...EMPTY_IMPORT, text: source, build: { ...normalizeBuildDraft(undefined, 'set:abc'), step: 'preparing', coverage: 'focus', focus: 'recall', generation: { status: 'running', key: 'stable-key', fingerprint: 'input' } } } };
  const restored = parseWorkspace(JSON.stringify(w));
  assert.equal(restored.destination, 'set:abc');
  assert.equal(restored.importDraft.build.existingPatchId, 'abc');
  assert.equal(restored.importDraft.build.generation.key, 'stable-key');
  assert.equal(restored.importDraft.build.focus, 'recall');
});
test('interrupted file reading becomes a recoverable error without dropping accepted files or text', () => {
  const accepted = { id: 'ok', name: 'good.txt', text: source, size: 150, status: 'accepted' };
  const w = { ...EMPTY_WORKSPACE, importDraft: { ...EMPTY_IMPORT, text: source, attachments: [accepted, { id: 'pending', name: 'later.pdf', text: '', status: 'reading' }] } };
  const d = parseWorkspace(JSON.stringify(w)).importDraft;
  assert.equal(d.text, source); assert.deepEqual(d.attachments[0], accepted);
  assert.equal(d.attachments[1].status, 'failed'); assert.match(d.attachments[1].error, /interrupted/);
});
test('legacy drafts keep their values and build defaults do not choose an existing Patch', () => {
  const w = { ...EMPTY_WORKSPACE, importDraft: { ...EMPTY_IMPORT, text: source } };
  assert.deepEqual(parseWorkspace(JSON.stringify(w)), w);
  assert.equal(normalizeBuildDraft().destinationMode, 'new');
  assert.equal(normalizeBuildDraft().existingPatchId, '');
  assert.equal(normalizeBuildDraft({ step: 'invalid', coverage: 'invented' }).step, 1);
});
