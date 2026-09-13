"use client";
import {useEffect} from 'react';
import {Recovery} from './reliability/fallback';
import {reportDiagnostic} from '../lib/reliability/observability';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){useEffect(()=>{reportDiagnostic({event:'fatal'});},[]);return <Recovery retry={reset}/>;}
