// Isolated browser regression entry: real UI/APIs, test-only signed identity.
import { createRoot } from 'react-dom/client';
import Patch from '../../app/page';
import '../../app/globals.css';
import '../../mobile/fonts.css';
import { configureNativeAuth } from '../../lib/auth-platform';
const fixture=await (await fetch('/__test_auth')).json();
const restored=sessionStorage.getItem('onboarding-fixture-session');
let current=restored==='signedout'||(new URL(location.href).searchParams.has('signedout')&&restored!=='signedin')?null:fixture.identity;
const listeners=new Set();
const accept=next=>{current=next;sessionStorage.setItem('onboarding-fixture-session',next?'signedin':'signedout');for(const listener of listeners)listener(next);};
window.onboardingAuth={expire:()=>accept(null)};
configureNativeAuth({
 initialize:async()=>current,
 getSession:async()=>current,
 getToken:async()=> (await (await fetch('/__test_auth')).json()).token,
 subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
 startEmail:async(_email,signUp)=>{window.onboardingAuth.startedAsSignup=signUp;},
 verifyEmail:async code=>{if(code!=='123456')throw Error('Invalid test code');accept(fixture.identity);return current;},
 signOut:async()=>accept(null),
});
createRoot(document.getElementById('root')).render(<Patch/>);
