import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LessonExperience } from '../../features/my-lesson/lesson-experience';
import { createMockLessonAdapter, mockLesson } from '../../features/my-lesson/mock-adapter';
import type { LessonAdapter, TimeBudget } from '../../features/my-lesson/contracts';
import '../../app/globals.css';
// This entry is served only by the isolated development Vite harness. Never imported by app/mobile.
const fixture = { calls: 0, helpCalls: 0, captures: 0, slow: false, fail: false, loadFail: false, budget: null as TimeBudget | null, operations: [] as string[], scope: (key: string) => { void key; }, start: (empty = false) => { void empty; } };
Object.assign(window, { fixture });
const mock = createMockLessonAdapter();
const pause = () => new Promise(resolve => setTimeout(resolve, fixture.slow ? 400 : 20));
const adapter: LessonAdapter = {
  async load(context) { await pause(); if (fixture.loadFail) throw Error('raw secret must never be rendered'); return mock.load(context); },
  async evaluate(input, context) { fixture.calls++; fixture.operations.push(context.operationId); await pause(); if (fixture.fail) throw Error('raw secret'); return mock.evaluate(input, context); },
  async help(input, context) { fixture.helpCalls++; await pause(); return mock.help(input, context); },
  async retainLearning(input, context) { fixture.captures++; await pause(); return mock.retainLearning!(input, context); },
};
const emptyAdapter = createMockLessonAdapter({ ...mockLesson, activities: [] });
function Preview() {
  const [started, setStarted] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [scope, setScope] = useState('preview');
  useEffect(() => {
    fixture.scope = setScope;
    fixture.start = (value = false) => { setEmpty(value); setStarted(true); };
  }, []);
  return <main style={{ paddingBottom: 24 }}><p style={{ textAlign: 'center' }}>Development preview · mockのみ / 保存なし</p>{started ? <LessonExperience sessionKey={scope} adapter={empty ? emptyAdapter : adapter} onHome={() => setStarted(false)} onBudgetChange={budget => { fixture.budget = budget; }} /> : <section style={{ maxWidth: 720, margin: 'auto', padding: 24 }}><h1>My Lesson preview</h1><button data-primary onClick={() => setStarted(true)}>Today&apos;s My Lesson</button></section>}</main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>);
