import { localDate, validTimezone, widgetState, type RetentionSnapshot } from './retention.ts';

// Labels only: membership and scheduling remain owned by the retention snapshot.
export function patchDuePresentation(cards: { id: string; dueAt: string }[], snapshot: RetentionSnapshot | undefined, now: number): 'today' | 'overdue' | 'ready' {
  if (!snapshot || !cards.length || widgetState(snapshot, now) === 'STALE' || !validTimezone(snapshot.timezone)) return 'ready';
  const today = localDate(snapshot.generatedAt, snapshot.timezone);
  const dates = cards.map(card => Date.parse(card.dueAt));
  if (cards.some(card => !snapshot.dueCardIds.includes(card.id)) || dates.some(date => !Number.isFinite(date))) return 'ready';
  const days = dates.map(date => localDate(date, snapshot.timezone));
  if (days.some(day => day > today)) return 'ready';
  return days.some(day => day < today) ? 'overdue' : 'today';
}
