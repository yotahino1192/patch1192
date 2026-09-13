export type NetworkState='online'|'offline'|'reconnected'|'foreground';
/** Connectivity is a hint, never authorization or proof the backend is ready. No request replay. */
export function watchNetwork(emit:(state:NetworkState)=>void,win:Window=window,doc:Document=document) {
 const online=()=>emit('reconnected'),offline=()=>emit('offline');
 const foreground=()=>{if(doc.visibilityState==='visible')emit(win.navigator.onLine?'foreground':'offline');};
 win.addEventListener('online',online);win.addEventListener('offline',offline);doc.addEventListener('visibilitychange',foreground);win.addEventListener('pageshow',foreground);
 emit(win.navigator.onLine?'online':'offline');
 return()=>{win.removeEventListener('online',online);win.removeEventListener('offline',offline);doc.removeEventListener('visibilitychange',foreground);win.removeEventListener('pageshow',foreground);};
}
export function singleFlight<T>(action:()=>Promise<T>):()=>Promise<T> {
 let pending:Promise<T>|undefined;
 return()=>{if(!pending)pending=Promise.resolve().then(action).finally(()=>{pending=undefined;});return pending;};
}
