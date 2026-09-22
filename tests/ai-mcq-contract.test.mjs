import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProviderMcq } from '../lib/ai/mcq-contract.ts';
import { logAiDiagnostic } from '../lib/ai/diagnostics.ts';
import { execution, ProviderError } from '../lib/ai/execution.ts';
import { generateMaterial } from '../lib/openai.ts';
import { validGeneratedCards } from '../lib/material-validation.ts';
import { reviewContentError } from '../lib/material-save.ts';
const card = { question: 'PRIVATE_QUESTION', difficulty: 1, format: 'multiple_choice', choices: ['PRIVATE_A', 'PRIVATE_B', 'PRIVATE_C', 'PRIVATE_D'], correctChoiceIndex: 2 };
const material = cards => ({ title: 'PRIVATE_TITLE', category: 'C', summary: '', keyPoints: ['PRIVATE_KEYPOINT'], cards });
const cases = [
  ['null item', null, 'item_shape'], ['array item', [], 'item_shape'],
  ['missing choices', { ...card, choices: undefined }, 'choices_not_array'],
  ['object choices', { ...card, choices: { a: 'PRIVATE_A' } }, 'choices_not_array'],
  ['zero choices', { ...card, choices: [] }, 'choice_count'],
  ['three choices', { ...card, choices: card.choices.slice(0, 3) }, 'choice_count'],
  ['five choices', { ...card, choices: [...card.choices, 'PRIVATE_E'] }, 'choice_count'],
  ['nonstring', { ...card, choices: [null, 1, {}, 'PRIVATE_D'] }, 'choice_type'],
  ['empty', { ...card, choices: ['', ...card.choices.slice(1)] }, 'choice_empty'],
  ['whitespace', { ...card, choices: [' \t\n\u3000', ...card.choices.slice(1)] }, 'choice_empty'],
  ['duplicate', { ...card, choices: ['PRIVATE_A', 'PRIVATE_A', 'PRIVATE_C', 'PRIVATE_D'] }, 'choice_duplicate'],
  ['trim duplicate', { ...card, choices: [' PRIVATE_A\n', '\u3000PRIVATE_A\t', 'PRIVATE_C', 'PRIVATE_D'] }, 'choice_duplicate'],
  ['missing index', { ...card, correctChoiceIndex: undefined }, 'correct_index_type'],
  ['string index', { ...card, correctChoiceIndex: '2' }, 'correct_index_type'],
  ['fractional index', { ...card, correctChoiceIndex: 1.5 }, 'correct_index_type'],
  ['null index', { ...card, correctChoiceIndex: null }, 'correct_index_type'],
  ['negative index', { ...card, correctChoiceIndex: -1 }, 'correct_index_range'],
  ['one-based last index', { ...card, correctChoiceIndex: 4 }, 'correct_index_range'],
  ['conflicting answer', { ...card, answer: 'PRIVATE_A' }, 'unexpected_answer'],
];
async function mockProvider(cards, run) {
  const oldKey = process.env.OPENAI_API_KEY, oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'mock-only'; let calls = 0, payload;
  globalThis.fetch = async (_url, init) => {
    calls++; payload = JSON.parse(init.body);
    return Response.json({ status: 'completed', usage: { input_tokens: 10, output_tokens: 100 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify(material(cards)) }] }] }, { headers: { 'x-request-id': 'req_synthetic_mcq' } });
  };
  try { await run(() => calls, () => payload); }
  finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
}
const generate = () => execution.run({ endpoint: 'cards', dispatch: async () => {} }, () => generateMaterial({ text: 'PRIVATE_SOURCE', style: '4択問題', detail: '標準' }));
for (const [label, invalid, reason] of cases) test(`MCQ ${label}: terminal structural diagnostic and no second provider request`, async () => {
  await mockProvider([card, invalid], async calls => {
    await assert.rejects(generate(), error => {
      assert.ok(error instanceof ProviderError); assert.equal(error.uncertain, false);
      assert.equal(error.diagnostic.providerCode, 'invalid_choices');
      assert.equal(error.diagnostic.validationCode, reason); assert.equal(error.diagnostic.itemIndex, 1);
      assert.equal(error.diagnostic.validationStage, 'mcq_choices');
      assert.equal(error.diagnostic.providerRequestId, 'req_synthetic_mcq');
      const lines = []; logAiDiagnostic(error.diagnostic, line => lines.push(line));
      assert.doesNotMatch(JSON.stringify(error) + lines.join(''), /PRIVATE_/);
      return true;
    });
    assert.equal(calls(), 1);
  });
});
test('MCQ schema constrains 4 nonblank strings and zero-based enum; prompt is format-specific', async () => {
  await mockProvider([card], async (calls, payload) => {
    await generate(); const body = payload(), schema = body.text.format.schema.properties.cards.items;
    assert.equal(body.text.format.strict, true); assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties.correctChoiceIndex.enum, [0, 1, 2, 3]);
    assert.equal(schema.properties.choices.minItems, 4); assert.equal(schema.properties.choices.maxItems, 4);
    assert.equal(new RegExp(schema.properties.choices.items.pattern).test(' \t\u3000'), false);
    assert.equal(new RegExp(schema.properties.choices.items.pattern).test('X'), true);
    assert.equal(schema.properties.answer, undefined);
    assert.match(body.instructions, /最初=0、2番目=1、3番目=2、最後=3/);
    assert.match(body.instructions, /前後の空白を除去した後も4個すべて異なる/);
    assert.doesNotMatch(body.instructions, /一問一答ではanswerを書き/);
    assert.equal(calls(), 1);
  });
});
test('safe trimming preserves selected answer for every valid index and satisfies save/review validators', async () => {
  for (const index of [0, 1, 2, 3]) {
    await mockProvider([{ ...card, choices: card.choices.map(v => ` \t${v}\u3000\n`), correctChoiceIndex: index }], async () => {
      const result = await generate();
      assert.deepEqual(result.cards[0].choices, card.choices); assert.equal(result.cards[0].answer, card.choices[index]);
      assert.equal('correctChoiceIndex' in result.cards[0], false);
      assert.equal(validGeneratedCards(result.cards), true);
      assert.equal(reviewContentError({ ...result, cards: result.cards.map(c => ({ ...c, selected: true })) }), '');
      assert.equal(validGeneratedCards([{ ...result.cards[0], answer: 'NOT_A_CHOICE' }]), false);
    });
  }
  const result = validateProviderMcq({ ...card, choices: ['A B', 'A  B', 'AB', 'aB'] }, 0);
  assert.equal(result.ok, true, 'do not silently rewrite interior spacing or case');
});
test('diagnostic counts include trim duplicates and reject arbitrary strings/numbers', () => {
  const result = validateProviderMcq({ ...card, choices: ['', ' ', ' X', 'X '] }, 2);
  assert.equal(result.ok, false); assert.equal(result.diagnostic.choiceCount, 4);
  assert.equal(result.diagnostic.duplicateCount, 2); assert.equal(result.diagnostic.emptyChoiceCount, 2);
  assert.equal(result.diagnostic.correctIndexValid, true);
  const lines = [];
  logAiDiagnostic({ ...result.diagnostic, question: 'PRIVATE_Q', answer: 'PRIVATE_A', choices: ['PRIVATE_C'], source: 'PRIVATE_S', raw: 'PRIVATE_RAW' }, line => lines.push(JSON.parse(line)));
  assert.doesNotMatch(JSON.stringify(lines), /PRIVATE_/);
  logAiDiagnostic({ validationStage: 'PRIVATE_S', validationCode: 'PRIVATE_CODE', itemIndex: 'PRIVATE', choiceCount: Infinity, duplicateCount: -1, emptyChoiceCount: 0.5, nonStringChoiceCount: 10001, correctIndexValid: 'PRIVATE' }, line => lines.push(JSON.parse(line)));
  assert.deepEqual(Object.keys(lines[1]).sort(), ['event', 'timestamp']);
});
