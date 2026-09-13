import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {activityReducer, initialActivity, primaryAction, timeBudget, validateLesson} from '../features/my-lesson/state.ts';
import {mockLesson, createMockLessonAdapter} from '../features/my-lesson/mock-adapter.ts';
registerHooks({resolve(s,c,next){if(s==='next/link')return next('next/link.js',c);if(s.endsWith('.module.css'))return {url:'data:text/javascript,export default new Proxy({}, {get:(_,key)=>String(key)})',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s)){for(const ext of ['.ts','.tsx']){try{return next(new URL(s+ext,c.parentURL).href,c);}catch{}}}return next(s,c);},load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};return next(url,context);}});
const {ActivityRenderer} = await import('../features/my-lesson/renderers.tsx');
const {LessonComplete} = await import('../features/my-lesson/complete.tsx');
const {LessonExperience} = await import('../features/my-lesson/lesson-experience.tsx');

test('five renderers share controlled answer state and render without a second shell/primary action',()=>{
 for (const activity of mockLesson.activities) {
  const html=renderToStaticMarkup(React.createElement(ActivityRenderer,{activity,state:initialActivity(),onAnswer(){}}));
  assert.doesNotMatch(html,/<h1|data-primary|<footer/);
  if(activity.type==='LEARN')assert.ok(html.includes(activity.explanation));
  if(activity.type==='RECALL')assert.ok(html.includes('思い出して'));
  if(activity.type==='CHOICE')assert.equal((html.match(/type="radio"/g)||[]).length,2);
  if(['EXPLAIN','APPLY'].includes(activity.type))assert.match(html,/<textarea/);
 }
});
test('shared state refuses duplicate submission, response changes during feedback, and completed mutations',()=>{
 let state=activityReducer(initialActivity(),{type:'answer',response:'answer'});
 assert.equal(state.status,'ANSWERING');
 state=activityReducer(state,{type:'submit'});
 assert.equal(state.status,'SUBMITTING');
 assert.equal(activityReducer(state,{type:'submit'}),state);
 assert.equal(activityReducer(state,{type:'answer',response:'changed'}),state);
 state=activityReducer(state,{type:'feedback',feedback:{message:'ok'}});
 assert.equal(state.status,'FEEDBACK');
 state=activityReducer(state,{type:'complete'});
 assert.equal(state.status,'COMPLETED');
 assert.equal(activityReducer(state,{type:'answer',response:'changed'}),state);
});
test('recall reveals before response; choice/written responses gate submit and preserve answer after failure',()=>{
 const recall=mockLesson.activities[1];let state=initialActivity();
 assert.equal(primaryAction(recall,state).action,'reveal');
 state=activityReducer(state,{type:'reveal'});
 assert.equal(state.status,'ANSWERING');assert.equal(primaryAction(recall,state).disabled,true);
 for(const activity of mockLesson.activities.filter(a=>['CHOICE','EXPLAIN','APPLY'].includes(a.type))){
  let s=initialActivity();assert.equal(primaryAction(activity,s).disabled,true);
  s=activityReducer(s,{type:'answer',response:'a'});assert.equal(primaryAction(activity,s).disabled,false);
  s=activityReducer(s,{type:'submit'});assert.equal(primaryAction(activity,s).disabled,true);
  s=activityReducer(s,{type:'error'});assert.equal(s.response,'a');assert.equal(s.status,'ERROR');
  assert.equal(primaryAction(activity,s).disabled,false);
 }
});
test('controlled selected/disabled/revealed renderer states are accessible',()=>{
 const choice=mockLesson.activities[2];
 const html=renderToStaticMarkup(React.createElement(ActivityRenderer,{activity:choice,state:{status:'SUBMITTING',response:'a',revealed:false},onAnswer(){}}));
 assert.match(html,/<fieldset disabled/);assert.match(html,/checked=""/);assert.match(html,/data-selected="true"/);assert.match(html,/<legend/);
 const reveal=renderToStaticMarkup(React.createElement(ActivityRenderer,{activity:mockLesson.activities[1],state:{status:'ANSWERING',response:'',revealed:true},onAnswer(){}}));
 assert.ok(reveal.includes(mockLesson.activities[1].answer));
});
test('budget clamps remaining but does not mutate/remove activities or force five-card completion',()=>{
 assert.equal(mockLesson.activities.length,6);
 const budget=timeBudget(mockLesson,1000,5);
 assert.equal(budget.remainingSeconds,0);assert.equal(budget.elapsedSeconds,1000);assert.equal(budget.estimatedSeconds,30);
 assert.equal(mockLesson.activities.length,6);assert.equal(timeBudget(mockLesson,10,6).estimatedSeconds,0);
});
test('adapter validation accepts empty and rejects invalid target, ids, types and choices',()=>{
 assert.equal(validateLesson(mockLesson),mockLesson);
 assert.equal(validateLesson({...mockLesson,activities:[]}).activities.length,0);
 for(const targetMinutes of [0,4,16,NaN])assert.throws(()=>validateLesson({...mockLesson,targetMinutes}));
 assert.throws(()=>validateLesson({...mockLesson,activities:[mockLesson.activities[0],mockLesson.activities[0]]}));
 assert.throws(()=>validateLesson({...mockLesson,activities:[{...mockLesson.activities[0],type:'SIMULATION'}]}));
 assert.throws(()=>validateLesson({...mockLesson,activities:[{...mockLesson.activities[2],choices:[]}]}));
});
test('complete variants share one Home CTA and do not calculate streak',()=>{
 for(const variant of ['normal','firstLesson']){
  const html=renderToStaticMarkup(React.createElement(LessonComplete,{lesson:mockLesson,actualSeconds:82,variant,onHome(){}}));
  assert.equal((html.match(/data-primary/g)||[]).length,1);assert.match(html,/1分22秒/);assert.match(html,/Streak：3日/);assert.match(html,/ホームへ/);
 }
});
test('mock adapter does not dispatch network, supports cancellation and evaluator boundary',async()=>{
 const adapter=createMockLessonAdapter(),controller=new AbortController(),context={signal:controller.signal,operationId:'test'};
 assert.equal((await adapter.load(context)).activities.length,6);
 const answer=await adapter.evaluate({lessonId:'test',activity:mockLesson.activities[2],response:'b'},context);assert.equal(answer.correct,false);
 controller.abort();await assert.rejects(adapter.load(context));
});
test('initial feature rendering is safe loading, no production navigation or imports added',()=>{
 const html=renderToStaticMarkup(React.createElement(LessonExperience,{adapter:createMockLessonAdapter(),sessionKey:'scope',onHome(){}}));
 assert.match(html,/Lessonを準備/);assert.match(html,/aria-busy="true"/);
 for(const file of ['app/page.tsx','mobile/main.tsx']){const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/my-lesson|lesson-experience/);}
});
