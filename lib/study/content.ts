import type { StudyContent } from './types';
/** Old MCQs may contain padding. Unusable options fall back to honest self-assessed recall. */
export function studyContent(content: StudyContent): StudyContent {
  const question = content.question.trim(), answer = content.answer.trim();
  const choices = content.choices.map(c => c.trim());
  const validChoice = choices.length >= 2 && choices.length <= 6 && choices.every(Boolean) && new Set(choices).size === choices.length && choices.includes(answer);
  return { question, answer, format: content.format === 'self_explain' || content.format === 'multiple_choice' && !validChoice ? 'qa' : content.format,
    choices: content.format === 'multiple_choice' && validChoice ? choices : [] };
}
