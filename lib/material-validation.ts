import type { GeneratedCard, GeneratedMaterial, CardFormat } from './types';
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string' && v.length <= max && (empty || !!v.trim());
export function validGeneratedCards(value: unknown): value is GeneratedCard[] {
  if (!Array.isArray(value) || !value.length || value.length>100) return false;
  return value.every(c => {
    if (!c || !text(c.question,5000) || !text(c.answer,10000) || !Number.isInteger(c.difficulty) || c.difficulty<1 || c.difficulty>3 || !['qa','multiple_choice','self_explain'].includes(c.format) || !Array.isArray(c.choices)) return false;
    if (c.format !== 'multiple_choice') return c.choices.length===0;
    const choices = c.choices;
    return choices.length===4 && choices.every((v:unknown)=>text(v,10000)) && new Set(choices.map((v:string)=>v.trim())).size===4 && choices.map((v:string)=>v.trim()).includes(c.answer.trim());
  });
}
export function validGeneratedMaterial(value: unknown, format: CardFormat, maximum=20): value is GeneratedMaterial {
  if (!value || typeof value!=='object') return false;
  const v=value as GeneratedMaterial;
  return text(v.title,120) && text(v.category,60,true) && text(v.summary,10000,true) && Array.isArray(v.keyPoints) && v.keyPoints.length>0 && v.keyPoints.length<=8 && v.keyPoints.every(p=>text(p,5000)) && validGeneratedCards(v.cards) && v.cards.length<=maximum && v.cards.every(c=>c.format===format);
}
