"use client";
import { useEffect, useId, useRef, useState } from "react";
import { legalDocuments, legalKinds, type LegalKind } from "../lib/public-pages/content";
import { DocumentBody, PublicationNotice } from "./public-pages/document-body";
export type { LegalKind } from "../lib/public-pages/content";
export function LegalContent({kind}:{kind:LegalKind}) {
 const [navigation, setNavigation] = useState<{source: LegalKind; target: LegalKind; section?: string} | null>(null);
 const current = navigation?.source === kind ? navigation.target : kind;
 const document = legalDocuments[current];
 const prefix = useId();
 const container = useRef<HTMLElement>(null);
 useEffect(() => {
   if (!navigation || navigation.source !== kind) return;
   const section = navigation.section;
   const target = section
     ? Array.from(container.current?.querySelectorAll<HTMLElement>("h3[id]") ?? []).find(h => h.id === `${prefix}-${section}`)
     : undefined;
   const heading = target ?? container.current?.querySelector<HTMLElement>("h2");
   if (heading) { heading.tabIndex = -1; heading.focus(); }
 }, [navigation, kind, prefix]);
 const navigate = (href: string) => {
   const [path, anchor] = href.slice(1).split("#");
   const target = legalKinds.find(k => k === path);
   if (target) setNavigation({source: kind, target, section: anchor?.replace(`${target}-`, "")});
 };
 return <section ref={container} className="legal-content"><h2 style={{fontSize:"var(--text-heading, 20px)",lineHeight:1.5}}>{document.title}</h2><p>{document.intro}</p><PublicationNotice/><DocumentBody kind={current} headingLevel={3} anchorPrefix={prefix} onNavigate={navigate}/></section>;
}
export function LegalLinks({kinds=["privacy","support","terms"]}:{kinds?:LegalKind[]}={}) {
 const [kind,setKind]=useState<LegalKind|null>(null);
 const id=useId();
 return <div className="legal-links">{kinds.map(k=><button type="button" key={k} aria-expanded={kind===k} aria-controls={`${id}-${k}`} onClick={()=>setKind(kind===k?null:k)}>{k==="privacy"?"Privacy Policy":k==="support"?"Support":"Terms"}</button>)}{kinds.map(k=><div id={`${id}-${k}`} key={k} hidden={kind!==k} style={{width:"100%"}}>{kind===k&&<LegalContent kind={k}/>}</div>)}</div>;
}
