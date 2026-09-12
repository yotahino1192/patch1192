"use client";
import {useState} from "react";
export type LegalKind="privacy"|"support"|"terms";
const content={
 privacy:["Privacy Policy — 公開準備中", "PatchはClerkでログインを管理し、教材・カード・学習履歴・会話をTursoのDBに保存し、Vercel上のAPIで処理します。AIを利用するときは、説明に同意した後でOpenAIへ関連する文章を送信します。AIの許可は設定から停止できます。", "添付資料は端末で文章を抽出します。下書きは端末に保存されます。アカウント削除は設定から開始できます。処理中の送信やオフラインの別端末を即時消去できない場合があります。", "運営者情報、問い合わせ先、保持期間、バックアップからの削除期限は公開準備待ちです。この内容は最終版のPrivacy Policyではありません。"],
 support:["Support — 公開準備中", "正式なサポート窓口・URLは未設定です。公開前に運営者が設定する必要があります。教材本文や認証コードを問い合わせ資料へ含めないでください。"],
 terms:["Terms — 公開準備中", "正式な利用規約は準備中です。AIの回答には誤りが含まれる場合があります。送信する教材を利用・送信する権利を確認してください。運営者と正式な条件は公開前に確定します。"],
};
export function LegalContent({kind}:{kind:LegalKind}) {return <section className="legal-content"><h2>{content[kind][0]}</h2>{content[kind].slice(1).map(p=><p key={p}>{p}</p>)}</section>;}
export function LegalLinks({kinds=["privacy","support","terms"]}:{kinds?:LegalKind[]}={}) {
 const [kind,setKind]=useState<LegalKind|null>(null);
 return <div className="legal-links">{kinds.map(k=><button type="button" key={k} onClick={()=>setKind(kind===k?null:k)}>{k==="privacy"?"Privacy Policy":k==="support"?"Support":"Terms"}</button>)}{kind&&<LegalContent kind={kind}/>}</div>;
}
