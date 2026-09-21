// Full App with real authenticated APIs and isolated test identity/material only.
import { createRoot } from 'react-dom/client';
import Patch from '../../app/page';
import { configureNativeAuth } from '../../lib/auth-platform';
import { configureRetention } from '../../lib/retention-platform';
import { writeAccountWorkspace, readAccountWorkspace } from '../../lib/account-storage';
import { EMPTY_WORKSPACE } from '../../lib/workspace';
import { normalizeBuildDraft } from '../../lib/build-draft';
import '../../app/globals.css';
import '../../mobile/fonts.css';
const config = await (await fetch('/__build_review_identity')).json();
const originalFetch = window.fetch.bind(window);
const fixture = window.reviewFixture = { writes: [], aiCalls: 0, aiRequests: [], failSave: false, loseSave: false, holdSave: false, failStart: false };
const links=[];
configureRetention({activate:async()=>{},clear:async()=>{},publish:async()=>{},permission:async()=>({granted:false}),links:async()=>({links:links.splice(0)})});
fixture.resumeLink=()=>links.push({url:'patch://continue',owner:config.identity.userId,at:Date.now()});
window.fetch = async (path, options) => {
  const url=String(path), body=typeof options?.body==='string'?JSON.parse(options.body):null;
  if(options?.method==='POST')fixture.writes.push({url,body});
  if(url.includes('/api/ai/'))fixture.aiCalls++;
  if(url.startsWith('/api/privacy/consents') && fixture.consentUnavailable)return Response.json({error:'Consent unavailable'},{status:503});
  // Opt-in transport fixture: production generation hook, real save/study APIs.
  // The authenticated generation route/provider contract is covered in free-v1-learning.test.mjs.
  if(url==='/api/ai/cards' && fixture.mockGeneration) {
    const format=body.style==='4択問題'?'multiple_choice':'qa';
    return Response.json({title:'Generated '+(body.inputKind||'source'),category:'Biology',summary:'Photosynthesis basics',keyPoints:['Light and water'],...(body.inputKind==='topic'?{sourceKind:'topic'}:{}),cards:[1,2].map(i=>({question:'What powers photosynthesis? '+i,answer:'Sunlight',choices:format==='multiple_choice'?['Sunlight','Wind','Sound','Gravity']:[],format,difficulty:1}))});
  }
  if(url==='/api/ai/chat') {
    fixture.aiRequests.push({body,key:new Headers(options.headers).get('Idempotency-Key')});
    const mode=fixture.explanationMode;
    if(mode==='loading'||mode==='delayedError')await new Promise(resolve=>fixture.releaseExplanation=resolve);
    if(mode==='delayedError')return Response.json({code:'AI_PROVIDER_FAILED'},{status:502});
    if(mode==='network')throw new TypeError('Fixture network failure');
    if(mode==='unknown')return Response.json({code:'AI_REQUEST_UNKNOWN'},{status:503});
    if(mode==='provider')return Response.json({code:'AI_PROVIDER_FAILED'},{status:502});
    return Response.json({answer:'The correct choice follows directly from the source: higher borrowing costs reduce spending and demand.'});
  }
  if(url==='/api/retention' && body?.action==='start' && fixture.failStart)return Response.json({error:'Test start failure'},{status:503});
  const saving=url==='/api/data' && ['saveSet','addCardsToSet'].includes(body?.action);
  const reviewing=url==='/api/data' && body?.action==='reviewCard';
  if(reviewing && fixture.failReview)throw new TypeError('Fixture offline answer');
  if(reviewing && fixture.holdReview)await new Promise(resolve=>fixture.releaseReview=resolve);
  if(saving && fixture.holdSave)await new Promise(resolve=>fixture.releaseSave=resolve);
  if(saving && fixture.failSave)return Response.json({error:'Test validation failure'},{status:400});
  const result=await originalFetch(path,options);
  if(reviewing && fixture.loseReview){fixture.loseReview=false;throw new TypeError('Fixture lost committed answer');}
  if(saving && fixture.loseSave){fixture.loseSave=false;throw Error('Test lost response after commit');}
  return result;
};
configureNativeAuth({ initialize:async()=>config.identity,getSession:async()=>config.identity,getToken:async()=>(await(await originalFetch('/__build_review_identity')).json()).token,subscribe:()=>()=>{},startEmail:async()=>{},verifyEmail:async()=>config.identity,signOut:async()=>{} });
const root=createRoot(document.getElementById('root'));
fixture.reset=()=>writeAccountWorkspace(localStorage,config.identity.userId,EMPTY_WORKSPACE);
fixture.workspace=()=>readAccountWorkspace(localStorage,config.identity.userId);
fixture.stage=(format='qa',focus=false,invalid=false)=>{
  const source='Interest rates affect borrowing costs. Higher borrowing costs can reduce spending and demand, which can ease inflation.';
  const cards=[{question:'How can higher interest rates affect inflation?',answer:'By reducing spending and demand',choices:format==='multiple_choice'?['By reducing spending and demand','By increasing spending','By fixing all prices','By removing taxes']:[],format,difficulty:2},{question:'What do higher interest rates increase?',answer:'Borrowing costs',choices:format==='multiple_choice'?['Borrowing costs','Money supply','Tax refunds','Wages']:[],format,difficulty:1}].map((c,i)=>({...c,draftId:'draft-'+i,selected:true}));
  const style=format==='multiple_choice'?'4択問題':'一問一答';
  const build={...normalizeBuildDraft(),step:'review',coverage:focus?'focus':'whole',focus:focus?'How interest rates affect inflation':'',generation:{status:'succeeded',key:crypto.randomUUID(),fingerprint:JSON.stringify({text:source,detail:'標準',style,language:'ja',...(focus?{focus:'How interest rates affect inflation'}:{})})}};
  writeAccountWorkspace(localStorage,config.identity.userId,{...EMPTY_WORKSPACE,importDraft:{text:source,detail:'標準',style,attachments:[],build},draft:{title:'Interest Rates and Inflation',category:'Economics',summary:'Interest rates influence borrowing costs and inflation.',sourceContent:source,keyPoints:invalid?[]:['Understand what interest rates are','Learn how interest rates affect inflation','Explore the relationship with economic growth','Apply key concepts to real-world examples'],cards}});
};
root.render(<Patch />);
