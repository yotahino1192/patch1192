// Development/test entry only. Production entrypoints never import this file.
import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Home} from '../../app/home-screen';
import {Shell, Study} from '../../app/page'; // Exported only by the test Vite plugin.
import {AccountContext} from '../../app/account-context';
import {LanguageProvider} from '../../app/language';
import {EMPTY_SESSION} from '../../lib/workspace';
import '../../app/globals.css';
import '../../mobile/fonts.css';
const params=new URL(location.href).searchParams, state=params.get('state')||'normal';
const now=new Date('2026-09-14T10:00:00+09:00');
const cards=Array.from({length:6},(_,i)=>({id:'c'+i,setId:'s0',question:'How does retrieval support memory?',answer:'Recalling information strengthens access to it.',format:'qa',choices:[],status:'未学習',difficulty:2,dueAt:now.toISOString(),intervalDays:0,reviewCount:0,correctCount:0,createdAt:now.toISOString(),updatedAt:now.toISOString()}));
const titles=['Learning through recall','Spaced practice','Building understanding'];
const sets=titles.map((title,i)=>({id:'s'+i,title,category:'Learning',summary:'Revisit what you know and practise recalling it in your own words.',sourceContent:'Fixture only',keyPoints:[],cards:cards.map(c=>({...c,id:c.id+'s'+i,setId:'s'+i})),lastStudiedAt:new Date(now.getTime()-i*86400000).toISOString(),nextReviewAt:null}));
if(params.has('long'))sets[0].summary=('思い出す練習を通して学んだことを確認し、自分の言葉で説明してみましょう。').repeat(12);
const completed=state==='completed'||state==='complete';
const snapshot={version:1,generatedAt:now.getTime(),expiresAt:now.getTime()+3600000,day:20,dayEnd:now.getTime()+5000000,timezone:'Asia/Tokyo',achievedDays:state==='broken'?[14,15,16,17,18]:completed?[16,17,18,19,20]:[16,17,18,19],streak:state==='broken'?0:completed?5:4,hot:['hot','completed','complete'].includes(state),completed,broken:state==='broken',dueCount:0,dueCardIds:[],reminderTime:'18:00',reviewReminder:false,streakWarning:false};
if(state==='stale')snapshot.expiresAt=now.getTime()-1;
const data={profile:{displayName:params.has('long')?'Alexandra · 学び続ける人のための長い名前':'Alex',onboardingCompleted:true},retention:snapshot,sets:state==='empty'?[]:sets,folders:[],reviews:[],chatMessages:[],dailyReview:{day:'2026-09-14',cardIds:[],completedCardIds:[],achievedDays:[],streak:0,completed:false}};
window.uiFixture={starts:0,samples:0,reads:[],pending:[]};
const request=async(url,options)=>{window.uiFixture.reads.push({url,method:options?.method||'GET'});if(!url.startsWith('/api/domain?'))return Response.json(snapshot);const id=new URL(url,'http://fixture').searchParams.get('id');return new Promise(resolve=>{window.uiFixture.pending.push(()=>resolve(Response.json({id,estimatedSeconds:480})));});};
const account={scope:{account:{userId:'visual-fixture'},request},logout:async()=>{}};
const paused=['saved-a','saved-b'].map((id,i)=>({...EMPTY_SESSION,id,setId:'s'+i,queue:sets[i].cards.map(c=>c.id),total:6}));
function Fixture(){const [fixtureData,setFixtureData]=useState(data);useEffect(()=>{window.uiFixture.updateSnapshot=patch=>setFixtureData(previous=>({...previous,retention:{...previous.retention,...patch}}));return()=>{delete window.uiFixture.updateSnapshot;};},[]);const [screen,setScreen]=useState(state==='complete'?'study':'home');const session={...EMPTY_SESSION,id:'fixture-session',done:true,setId:'s0',total:6,mistakes:2};
const home=<Home data={fixtureData} now={now} startStudy={()=>window.uiFixture.starts++} setScreen={setScreen} selectSet={()=>{}} onContinue={()=>window.uiFixture.starts++} resumableSessions={state==='resume'?paused:[]} onResume={()=>window.uiFixture.starts++} onSample={async()=>{window.uiFixture.samples++;}}/>;
return <AccountContext.Provider value={state==='resume'?account:null}><Shell screen={screen} setScreen={setScreen}>{screen==='study'?<Study session={session} updateSession={()=>{}} data={fixtureData} queue={[]} flipped={false} setFlipped={()=>{}} setQueue={()=>{}} sessionDone={true} setSessionDone={()=>{}} sessionSetId="s0" sessionId={session.id} sessionTotal={6} sessionMistakes={2} setSessionMistakes={()=>{}} startStudy={()=>{}} setData={()=>{}} backToSets={()=>{}} goHome={()=>setScreen('home')} onPause={()=>{}} now={now}/>:home}</Shell></AccountContext.Provider>}
createRoot(document.getElementById('root')).render(<LanguageProvider initialLanguage={params.get('lang')||'en'}><Fixture/></LanguageProvider>);
