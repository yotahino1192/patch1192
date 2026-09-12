import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalDocuments, legalKinds } from '../lib/public-pages/content.ts';
import { publicLegalConfig, legalFieldLabels, canIndexPublicPages, contactHref } from '../lib/public-pages/config.ts';
registerHooks({resolve(s,c,next){if(s==='next/link')return next('next/link.js',c);if(s.endsWith('.module.css'))return {url:'data:text/javascript,export default new Proxy({}, {get:(_,key)=>String(key)})',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s)){for(const ext of ['.ts','.tsx']){try{return next(new URL(s+ext,c.parentURL).href,c);}catch{}}}return next(s,c);},load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};return next(url,context);}});
const {PublicDocument}=await import('../app/public-pages/public-document.tsx');
const {LegalContent}=await import('../app/legal-content.tsx');
const {publicPageMetadata}=await import('../app/public-pages/metadata.ts');

test('public pages render complete content without authentication and share embedded content',()=>{
 for(const kind of legalKinds){const html=renderToStaticMarkup(React.createElement(PublicDocument,{kind})),inline=renderToStaticMarkup(React.createElement(LegalContent,{kind}));
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.equal((html.match(/<main\b/g)||[]).length,1);
 assert.equal((html.match(/<h2\b/g)||[]).length,legalDocuments[kind].sections.length);assert.equal((inline.match(/<h3\b/g)||[]).length,legalDocuments[kind].sections.length);
 assert.match(html,/本文へスキップ/);assert.match(html,/aria-current="page"/);assert.match(html,/公開準備版/);
 for(const section of legalDocuments[kind].sections){assert.ok(html.includes(`id="${kind}-${section.id}"`));assert.ok(html.includes(`href="#${kind}-${section.id}"`));for(const text of section.paragraphs){assert.ok(html.includes(text));assert.ok(inline.includes(text));}}
 assert.doesNotMatch(html,/<form\b|<input\b|mailto:|sign-in|__clerk/);
 }
});
test('draft metadata explicitly replaces app title/social description and remains non-indexable',()=>{
 for(const kind of legalKinds){const metadata=publicPageMetadata(kind);assert.ok(metadata.title.absolute.includes('Patch'));assert.equal(metadata.description,legalDocuments[kind].description);assert.deepEqual(metadata.robots,{index:false,follow:false,googleBot:{index:false,follow:false}});assert.equal(metadata.openGraph.title,metadata.title.absolute);assert.equal(metadata.twitter.title,metadata.title.absolute);assert.deepEqual(metadata.openGraph.images,[]);}
});
test('all unresolved publication fields are explicit and cannot accidentally enable indexing or contact',()=>{
 assert.equal(publicLegalConfig.publicationStatus,'draft');assert.ok(Object.values(publicLegalConfig.fields).every(v=>v===null));assert.equal(contactHref(),undefined);assert.equal(canIndexPublicPages(),false);
 const covered=new Set(Object.values(legalDocuments).flatMap(doc=>doc.sections.flatMap(s=>s.fields||[])));assert.deepEqual([...covered].sort(),Object.keys(legalFieldLabels).sort());
 assert.equal(canIndexPublicPages({...publicLegalConfig,publicationStatus:'published'}),false);
 for(const email of ['javascript:alert(1)','a@example.com\r\nBcc:private','not-an-email'])assert.equal(contactHref({...publicLegalConfig,fields:{...publicLegalConfig.fields,contactEmail:email}}),undefined);
});
test('support has all required sections, internal anchors resolve, and no feature or legal conditions are invented',()=>{
 const ids=legalDocuments.support.sections.map(s=>s.id);for(const id of ['about','account','verification','learning-data','ai','privacy','deletion','contact'])assert.ok(ids.includes(id));
 for(const doc of Object.values(legalDocuments))for(const section of doc.sections)for(const link of section.links||[]){if(link.href.startsWith('/')){const [path,anchor]=link.href.slice(1).split('#');assert.ok(legalKinds.includes(path));if(anchor)assert.ok(legalDocuments[path].sections.some(s=>`${path}-${s.id}`===anchor));}else assert.ok(link.href.startsWith('https://'));}
 const content=JSON.stringify(legalDocuments);for(const text of ['Clerk','Turso','Vercel','OpenAI','同意の撤回','最小限','バックアップ','端末内','ユーザー設定'])assert.ok(content.includes(text));
 assert.doesNotMatch(content,/Sentry|APNs|Sign in with Apple|Streak|位置情報を収集|通知トークンを収集|30日以内に削除|東京地方裁判所|返金しません/);
});
