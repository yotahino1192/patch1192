// Isolated browser regression entry: real UI/APIs, test-only signed identity.
import { createRoot } from 'react-dom/client';
import Patch from '../../app/page';
import '../../app/globals.css';
import '../../mobile/fonts.css';
import { configureNativeAuth } from '../../lib/auth-platform';
const fixture=await (await fetch('/__test_auth')).json();
configureNativeAuth({
 initialize:async()=>fixture.identity,
 getSession:async()=>fixture.identity,
 getToken:async()=> (await (await fetch('/__test_auth')).json()).token,
 subscribe:()=>()=>{},
 startEmail:async()=>{throw Error('Not part of onboarding regression');},
 verifyEmail:async()=>null,
 signOut:async()=>{throw Error('Use the authentication browser suite for logout');},
});
createRoot(document.getElementById('root')).render(<Patch/>);
