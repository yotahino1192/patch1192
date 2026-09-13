import type { CompleteVariant, LessonViewModel } from './contracts';
import styles from './lesson.module.css';
export function LessonComplete({ lesson, actualSeconds, variant = 'normal', onHome }: { lesson: LessonViewModel; actualSeconds: number; variant?: CompleteVariant; onHome: () => void }) {
  return <section className={styles.shell} aria-labelledby="lesson-complete"><h1 id="lesson-complete" tabIndex={-1}>Lesson Complete</h1><p>{variant === 'firstLesson' ? 'はじめてのMy Lesson、おつかれさまでした。' : '今日のMy Lesson、おつかれさまでした。'}</p><p>学習時間：{Math.floor(actualSeconds / 60)}分{actualSeconds % 60}秒</p><h2>理解を深めたこと</h2><ul>{lesson.completion.strengthenedConcepts.map((concept, index) => <li key={index}>{concept}</li>)}</ul>{lesson.completion.streak !== undefined && <p>Streak：{lesson.completion.streak}日</p>}{lesson.completion.nextLessonTiming && <p>次のLesson：{lesson.completion.nextLessonTiming}</p>}<button className={styles.primary} data-primary onClick={onHome}>ホームへ</button></section>;
}
