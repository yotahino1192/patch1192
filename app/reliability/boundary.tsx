"use client";
import {Component,useEffect,useState,type ReactNode} from 'react';
import {Recovery} from './fallback';
import {reportDiagnostic} from '../../lib/reliability/observability';
import {watchNetwork,type NetworkState} from '../../lib/reliability/network';
export class ReliabilityBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){reportDiagnostic({event:'fatal'});}
 render(){return this.state.failed?<Recovery retry={()=>this.setState({failed:false})}/>:this.props.children;}
}
export function ReliabilityRuntime(){
 const [network,setNetwork]=useState<NetworkState>('online'),[unhandled,setUnhandled]=useState(false);
 useEffect(()=>{
  const stop=watchNetwork(setNetwork);
  // Never serialize Error/reason/event or replace the current workspace after an async failure.
  const failure=(event:Event)=>{event.preventDefault();reportDiagnostic({event:'unhandled'});setUnhandled(true);};
  window.addEventListener('error',failure);window.addEventListener('unhandledrejection',failure);
  return()=>{stop();window.removeEventListener('error',failure);window.removeEventListener('unhandledrejection',failure);};
 },[]);
 if(network==='online'&&!unhandled)return null;
 return <aside role="status" aria-live="polite" style={{padding:12,border:'1px solid currentColor',background:'var(--color-surface, #fff)',color:'var(--color-text, #222)'}}>
 {network==='offline'?'オフラインです。表示済み教材は確認できます。保存・AI・学習の記録は接続が必要です。':network==='reconnected'?'接続が戻りました。操作は自動再送していません。必要な画面で状態を確認してください。':network==='foreground'?'復帰しました。接続と現在のアカウントを確認して続けてください。':''}
 {unhandled&&<p>処理を完了できませんでした。表示中の内容は残しています。状態を確認してから操作してください。</p>}
 <button onClick={()=>{setUnhandled(false);if(network!=='offline')setNetwork('online');}}>閉じる</button>
 </aside>;
}
