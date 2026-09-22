import { extractDocument } from '../../lib/document-import';
import {documentFixtures as fixtures,fixtureText as text,normalizedText} from './document-files.mjs';
const results=[];for(const[format,data]of Object.entries(fixtures)){try{const result=await extractDocument(new File([data],'safe.'+format));results.push({format,ok:normalizedText(result)===text,length:result.length});}catch(e){results.push({format,ok:false,error:e.message,stack:e.stack});}}
document.querySelector('#result').textContent=JSON.stringify(results,null,2);window.webkit?.messageHandlers?.results?.postMessage(JSON.stringify(results));window.importResults=results;

fetch('/qa-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userAgent:navigator.userAgent,streamIterator:typeof ReadableStream.prototype[Symbol.asyncIterator],results})}).catch(()=>{});
