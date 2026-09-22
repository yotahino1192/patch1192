// Structural diagnostics only. Never put provider strings in this object.
export const mcqValidationCodes = [
  'item_shape', 'choices_not_array', 'choice_count', 'choice_type', 'choice_empty',
  'choice_duplicate', 'correct_index_type', 'correct_index_range', 'unexpected_answer',
] as const;
export type McqDiagnostic = {
  validationStage: 'mcq_choices'; validationCode: typeof mcqValidationCodes[number]; itemIndex: number;
  choiceCount?: number; duplicateCount?: number; emptyChoiceCount?: number; nonStringChoiceCount?: number;
  correctIndexValid: boolean;
};
type Result = { ok: true; choices: string[]; correctChoiceIndex: number } | { ok: false; diagnostic: McqDiagnostic };
export function validateProviderMcq(value: unknown, itemIndex: number): Result {
  const card = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  const raw = Array.isArray(card?.choices) ? card.choices : undefined;
  const choices = raw?.filter((v): v is string => typeof v === 'string').map(v => v.trim());
  const index = card?.correctChoiceIndex;
  const correctIndexValid = !!raw && Number.isInteger(index) && Number(index) >= 0 && Number(index) < 4 && Number(index) < raw.length;
  const structure = {
    validationStage: 'mcq_choices' as const, itemIndex, correctIndexValid,
    ...(raw && choices ? { choiceCount: raw.length, duplicateCount: choices.length - new Set(choices).size,
      emptyChoiceCount: choices.filter(v => !v).length, nonStringChoiceCount: raw.length - choices.length } : {}),
  };
  const fail = (validationCode: McqDiagnostic['validationCode']): Result => ({ ok: false, diagnostic: { ...structure, validationCode } });
  if (!card) return fail('item_shape');
  if (!raw || !choices) return fail('choices_not_array');
  if (raw.length !== 4) return fail('choice_count');
  if (choices.length !== raw.length) return fail('choice_type');
  if (choices.some(v => !v)) return fail('choice_empty');
  if (new Set(choices).size !== 4) return fail('choice_duplicate');
  if (!Number.isInteger(index)) return fail('correct_index_type');
  if (!correctIndexValid) return fail('correct_index_range');
  // The provider contract supplies only an index. Never silently overwrite a
  // second, potentially contradictory answer representation.
  if ('answer' in card) return fail('unexpected_answer');
  return { ok: true, choices, correctChoiceIndex: index as number };
}
