// Development/test entry only. Production entrypoints never import this file.
import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PrivacyContext} from '../../app/privacy-provider';
import {BuildReview, PatchReady} from '../../app/build-review';
import {Home} from '../../app/home-screen';
import {SetLibrary} from '../../app/set-library';
import {Shell, Study, SetDetail, Records, ImportScreen, Generate} from '../../app/page'; // Exported only by the test Vite plugin.
import {AccountContext} from '../../app/account-context';
import {LanguageProvider} from '../../app/language';
import {EMPTY_SESSION} from '../../lib/workspace';
import '../../app/globals.css';
import '../../mobile/fonts.css';
const params=new URL(location.href).searchParams, state=params.get('state')||'normal';
const now=new Date('2026-09-14T10:00:00+09:00');
const cards=Array.from({length:6},(_,i)=>({id:'c'+i,setId:'s0',question:'How does retrieval support memory?',answer:'Recalling information strengthens access to it.',format:'qa',choices:[],status:'未学習',difficulty:2,dueAt:now.toISOString(),intervalDays:0,reviewCount:0,correctCount:0,createdAt:now.toISOString(),updatedAt:now.toISOString()}));
const titles=['Learning through recall','Spaced practice','Building understanding'];
const sets=titles.map((title,i)=>({id:'s'+i,folderId:null,title,category:'Learning',summary:'Revisit what you know and practise recalling it in your own words.',sourceContent:'Fixture only',keyPoints:[],cards:cards.map(c=>({...c,id:c.id+'s'+i,setId:'s'+i})),lastStudiedAt:new Date(now.getTime()-i*86400000).toISOString(),nextReviewAt:null}));
if(params.has('long'))sets[0].title='思い出す練習を通して学びを深めるための長い教材タイトル / Learning through recall';
if(params.has('history'))sets.forEach((set,i)=>{if(i>=Number(params.get('history')))set.lastStudiedAt=null;});
if(params.has('long'))sets[0].summary=('思い出す練習を通して学んだことを確認し、自分の言葉で説明してみましょう。').repeat(12);
const completed=state==='completed'||state==='complete';
const snapshot={version:1,generatedAt:now.getTime(),expiresAt:now.getTime()+3600000,day:20,dayEnd:now.getTime()+5000000,timezone:'Asia/Tokyo',achievedDays:state==='broken'?[14,15,16,17,18]:completed?[16,17,18,19,20]:[16,17,18,19],streak:state==='broken'?0:completed?5:state==='hot'?7:4,hot:['hot','completed','complete'].includes(state),completed,broken:state==='broken',dueCount:0,dueCardIds:[],reminderTime:'18:00',reviewReminder:false,streakWarning:false};
if(state==='stale')snapshot.expiresAt=now.getTime()-1;
if(params.has('streak'))snapshot.streak=Number(params.get('streak'));
const data={profile:{displayName:params.has('long')?'Alexandra · 学び続ける人のための長い名前':'Alex',onboardingCompleted:true},retention:snapshot,sets:state==='empty'?[]:sets,folders:[],reviews:[],chatMessages:[],dailyReview:{day:'2026-09-14',cardIds:[],completedCardIds:[],achievedDays:[],streak:0,completed:false}};
// Screenshot comparison data only; never imported into the real application.
if(params.has('reference')) {
 data.profile.displayName='Yota';
 ['Supply & Demand','Inflation','Central Bank Basics'].forEach((title,i)=>{sets[i].title=title;sets[i].cards.forEach(card=>card.status='定着中');});
 sets.push({...sets[0],id:'current',title:'Interest Rates',lastStudiedAt:null,cards:cards.map(c=>({...c,setId:'current'}))});
}
window.uiFixture={starts:0,samples:0,reads:[],pending:[]};
const request=async(url,options)=>{window.uiFixture.reads.push({url,method:options?.method||'GET'});if(!url.startsWith('/api/domain?'))return Response.json(snapshot);const id=new URL(url,'http://fixture').searchParams.get('id');return new Promise(resolve=>{window.uiFixture.pending.push(()=>resolve(Response.json({id,estimatedSeconds:480})));});};
const account={scope:{account:{userId:'visual-fixture'},request},logout:async()=>{}};
const paused=['saved-a','saved-b'].map((id,i)=>({...EMPTY_SESSION,id,setId:'s'+i,queue:sets[i].cards.map(c=>c.id),total:6}));
function Fixture(){const [fixtureData,setFixtureData]=useState(data);useEffect(()=>{window.uiFixture.updateSnapshot=patch=>setFixtureData(previous=>({...previous,retention:{...previous.retention,...patch}}));return()=>{delete window.uiFixture.updateSnapshot;};},[]);const [screen,setScreen]=useState(state==='complete'?'study':'home');const session={...EMPTY_SESSION,id:'fixture-session',done:true,setId:'s0',total:6,mistakes:2};
const home=<Home data={fixtureData} now={now} startStudy={()=>window.uiFixture.starts++} setScreen={setScreen} selectSet={()=>{}} onContinue={()=>window.uiFixture.starts++} onChoosePatch={()=>setScreen("sets")} resumableSessions={state==='resume'?paused:[]} onResume={()=>window.uiFixture.starts++} onSample={async()=>{window.uiFixture.samples++;}}/>;
return <AccountContext.Provider value={state==='resume'?account:null}><Shell screen={screen} setScreen={setScreen}>{screen==='study'?<Study session={session} updateSession={()=>{}} data={fixtureData} queue={[]} flipped={false} setFlipped={()=>{}} setQueue={()=>{}} sessionDone={true} setSessionDone={()=>{}} sessionSetId="s0" sessionId={session.id} sessionTotal={6} sessionMistakes={2} setSessionMistakes={()=>{}} startStudy={()=>{}} setData={()=>{}} backToSets={()=>{}} goHome={()=>setScreen('home')} onPause={()=>{}} now={now}/>:home}</Shell></AccountContext.Provider>}
createRoot(document.getElementById('root')).render(<LanguageProvider initialLanguage={params.get('lang')||'en'}>{params.has('screen')?<MainScreensFixture/>:<Fixture/>}</LanguageProvider>);

function MainScreensFixture() {
  const [screen, setScreen] = useState(params.get('screen') || 'sets');
  const [folderId, setFolderId] = useState(null);
  const [setId, setSetId] = useState(params.has('detail') ? 's0' : null);
  const librarySets=[...sets,{...sets[0],id:'s3',title:'Practical economics',cards:sets[0].cards.map(card=>({...card,id:card.id+'s3',setId:'s3'}))}].map((set,i)=>({...set,folderId:i<3?'folder-'+i:null,title:params.has('long')&&i===0?'思い出す練習を通して学びを深めるための長い教材タイトル / Learning through recall':set.title}));
  const libraryDue=librarySets.flatMap(set=>set.cards.slice(0,2).map(card=>card.id));
  const noLibraryReviews=state==='empty'||state==='completed'||params.has('no-reviews');
  const libraryRetention=screen==='sets'?{...snapshot,dueCount:noLibraryReviews?0:libraryDue.length,dueCardIds:noLibraryReviews?[]:libraryDue}:snapshot;
  const [fixtureData, setFixtureData] = useState({...data, retention:libraryRetention, studyHistory:state==='empty'?[]:[{id:'history-1',title:sets[0].title,setId:'s0',processed:1,total:6,completedAt:now.toISOString(),results:[{id:'r1',rating:'good',cardId:'c0s0'}]}], recordActivity:state==='empty'?[]:[{day:'2026-09-14',cards:8},{day:'2026-09-12',cards:5},{day:'2026-09-10',cards:3}], sets:state==='empty'?[]:librarySets, folders:state==='empty'?[]:[0,1,2].map(i=>({id:'folder-'+i,name:params.has('long')&&i===0?'長いフォルダ名で表示が崩れないことを確認するための教材フォルダ':['School','AI','Career'][i],parentId:null}))});
  const step=params.get('step')||'1';
  const [importDraft, setImportDraft] = useState({text:params.has('step')?'Memory and recall. 記憶を思い出す練習。'.repeat(5):'',attachments:[],detail:'標準',style:'一問一答',build:{step:/^[123]$/.test(step)?Number(step):step,coverage:'focus',focus:'Memory / 記憶',generation:{status:state==='error'?'failed':'running',error:'Connection interrupted. Your material is saved. Try again.'}}});
  const [destination, setDestination] = useState('root');
  const [draft, setDraft] = useState({title:'Learning through recall',keyPoints:['Practice retrieving what you know.'],cards:cards.slice(0,2).map(c=>({...c,draftId:c.id,selected:true}))});
  const startStudy = (...args) => { window.uiFixture.starts++; window.uiFixture.lastStart = args; };
  let content;
  if(screen === 'sets') content = <SetLibrary data={fixtureData} now={now} folderId={folderId} openSetId={setId} onFolder={id=>{setFolderId(id);setSetId(null);}} onSet={setSetId} onStudy={startStudy} onData={setFixtureData} onAdd={()=>setScreen('import')}><SetDetail data={fixtureData} selectedSetId={setId} selectSet={setSetId} startStudy={startStudy} now={now} onData={setFixtureData}/></SetLibrary>;
  else if(screen === 'records') content = <Records data={fixtureData} now={now} startStudy={startStudy}/>;
  else if(screen === 'import') content = <ImportScreen data={fixtureData} importDraft={importDraft} setImportDraft={setImportDraft} destination={destination} setDestination={setDestination} generationRunning={importDraft.build.step==='preparing'&&state!=='error'} review={<BuildReview draft={draft} importDraft={importDraft} data={fixtureData} destination={destination} setDestination={setDestination} setDraft={setDraft} onSave={async()=>{}} saving={false} pendingSave={false} error={state==='error'?'Your Patch could not be saved. Try again.':''}/>} onGenerate={async()=>setScreen('generate')}/>;
  else if(screen === 'ready') content = <PatchReady saved={{title:sets[0].title,appended:false}} onStart={async()=>{throw Error('offline');}} onHome={()=>setScreen('home')}/>;
  else if(screen === 'study') content = <StudyFixture data={fixtureData}/>;
  else if(screen === 'generate') content = <Generate data={fixtureData} draft={draft} setDraft={setDraft} destination={destination} setDestination={setDestination} onSave={async()=>{}} onRegenerate={async()=>{}}/>;
  else content = <Home data={fixtureData} now={now} startStudy={startStudy} setScreen={setScreen} selectSet={setSetId} onContinue={startStudy} onChoosePatch={()=>{setFolderId(null);setSetId(null);setScreen("sets");}} resumableSessions={[]} onResume={startStudy} onSample={async()=>{}}/>;
  return <AccountContext.Provider value={params.has('settings')||screen==='study'?{...account,email:'long-address-for-responsive-check@example.test',scope:{...account.scope,request:async()=>{await new Promise(resolve=>setTimeout(resolve,150));throw Error('Network unavailable. Try again.');}}}:null}><PrivacyContext.Provider value={params.has('settings')?{change:async()=>{},refresh:async()=>({state:'revoked'})}:null}><Shell screen={screen==='ready'?'import':screen} buildStep={screen==='ready'?'ready':importDraft.build.step} setScreen={setScreen} title={screen==='sets'?'Patches':undefined}>{content}</Shell></PrivacyContext.Provider></AccountContext.Provider>;
}

function StudyFixture({data}) {
  const mcq=params.has('mcq');
  const studyData={...data,sets:[{...sets[0],cards:sets[0].cards.map(c=>({...c,format:mcq?'multiple_choice':'qa',question:params.has('long')?'長い日本語の質問と English content: '+c.question.repeat(4):c.question,choices:mcq?['Recall / 思い出す練習','Read / 読む','Sleep / 睡眠','Repeat / 繰り返す']:[],answer:mcq?'Recall / 思い出す練習':c.answer}))}]};
  const [session,updateSession]=useState({...EMPTY_SESSION,id:'qa-study',setId:'s0',queue:studyData.sets[0].cards.map(c=>c.id),total:6,aiOpen:params.has('ai'),aiCompose:params.has('ai')});
  const [flipped,setFlipped]=useState(false);
  return <Study session={session} updateSession={updateSession} data={studyData} queue={session.queue} flipped={flipped} setFlipped={setFlipped} setQueue={()=>{}} sessionDone={false} setSessionDone={()=>{}} sessionSetId="s0" sessionId={session.id} sessionTotal={6} sessionMistakes={0} setSessionMistakes={()=>{}} startStudy={()=>{}} setData={()=>{}} backToSets={()=>{}} goHome={()=>{}} onPause={()=>{}} now={now}/>;
}
