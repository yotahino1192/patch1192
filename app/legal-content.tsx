"use client";
import { useId, useState } from "react";
import { legalDocuments, type LegalKind } from "../lib/public-pages/content";
import { DocumentBody, PublicationNotice } from "./public-pages/document-body";
export type { LegalKind } from "../lib/public-pages/content";
export function LegalContent({kind}:{kind:LegalKind}) {
 const document=legalDocuments[kind];
 return <section className="legal-content"><h2 style={{fontSize:22,lineHeight:1.5}}>{document.title}</h2><p>{document.intro}</p><PublicationNotice/><DocumentBody kind={kind} headingLevel={3}/></section>;
}
export function LegalLinks({kinds=["privacy","support","terms"]}:{kinds?:LegalKind[]}={}) {
 const [kind,setKind]=useState<LegalKind|null>(null);
 const id=useId();
 return <div className="legal-links">{kinds.map(k=><button type="button" key={k} aria-expanded={kind===k} aria-controls={`${id}-${k}`} onClick={()=>setKind(kind===k?null:k)}>{k==="privacy"?"Privacy Policy":k==="support"?"Support":"Terms"}</button>)}{kinds.map(k=><div id={`${id}-${k}`} key={k} hidden={kind!==k} style={{width:"100%"}}>{kind===k&&<LegalContent kind={k}/>}</div>)}</div>;
}
