/* eslint-disable @next/next/no-img-element -- shared Web/Capacitor renderer; adapter supplies trusted visual assets. */
import type { ActivityState, ActivityViewModel } from './contracts';
import styles from './lesson.module.css';
type Props<T extends ActivityViewModel = ActivityViewModel> = { activity: T; state: ActivityState; onAnswer: (value: string) => void };
export function LearnRenderer({ activity }: Props<Extract<ActivityViewModel, { type: 'LEARN' }>>) {
  return <div><p>{activity.explanation}</p>{activity.example && <blockquote>{activity.example}</blockquote>}{activity.visual && <figure>{/* Adapter supplies a trusted asset and meaningful alt text. */}<img src={activity.visual.src} alt={activity.visual.alt} className={styles.visual} /></figure>}</div>;
}
export function RecallRenderer({ activity, state, onAnswer }: Props<Extract<ActivityViewModel, { type: 'RECALL' }>>) {
  return <div>{!state.revealed ? <p>まず、頭の中で思い出してみましょう。</p> : <><p>{activity.answer}</p><fieldset disabled={['SUBMITTING', 'FEEDBACK', 'COMPLETED'].includes(state.status)}><legend>どのくらい思い出せましたか？</legend>{[['remembered', '思い出せた'], ['practice', 'もう少し練習したい']].map(([id, label]) => <label key={id}><input type="radio" name={`recall-${activity.id}`} checked={state.response === id} onChange={() => onAnswer(id)} />{label}</label>)}</fieldset></>}</div>;
}
export function ChoiceRenderer({ activity, state, onAnswer }: Props<Extract<ActivityViewModel, { type: 'CHOICE' }>>) {
  return <fieldset disabled={['SUBMITTING', 'FEEDBACK', 'COMPLETED'].includes(state.status)}><legend>回答を1つ選んでください</legend>{activity.choices.map(choice => <label key={choice.id} data-selected={state.response === choice.id}><input type="radio" name={`choice-${activity.id}`} checked={state.response === choice.id} onChange={() => onAnswer(choice.id)} />{choice.label}</label>)}</fieldset>;
}
function WrittenResponse({ activity, state, onAnswer }: Props) {
  return <label>あなたの回答<textarea rows={5} maxLength={4000} value={state.response} disabled={['SUBMITTING', 'FEEDBACK', 'COMPLETED'].includes(state.status)} onChange={e => onAnswer(e.target.value)} aria-describedby={`hint-${activity.id}`} /><small id={`hint-${activity.id}`}>短い言葉でも大丈夫です。</small></label>;
}
export function ExplainRenderer(props: Props) { return <WrittenResponse {...props} />; }
export function ApplyRenderer(props: Props) { return <WrittenResponse {...props} />; }
export function ActivityRenderer(props: Props) {
  const { activity, state, onAnswer } = props;
  switch (activity.type) {
    case 'LEARN': return <LearnRenderer activity={activity} state={state} onAnswer={onAnswer} />;
    case 'RECALL': return <RecallRenderer activity={activity} state={state} onAnswer={onAnswer} />;
    case 'CHOICE': return <ChoiceRenderer activity={activity} state={state} onAnswer={onAnswer} />;
    case 'EXPLAIN': return <ExplainRenderer {...props} />;
    case 'APPLY': return <ApplyRenderer {...props} />;
  }
}
