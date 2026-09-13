"use client";
import {Recovery} from './reliability/fallback';
export default function GlobalError({reset}:{error:Error;reset:()=>void}){return <html lang="ja"><body><Recovery retry={reset}/></body></html>;}
