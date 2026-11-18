'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

type Recent={token:string;name:string;lastOpened:number};
const KEY='taskbox:recent-projects';
const valid=(s:string)=>/^[a-f0-9]{64}$/.test(s);
function readRecent():Recent[]{try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter((v):v is Recent=>!!v&&valid(v.token)&&typeof v.name==='string'&&typeof v.lastOpened==='number').sort((a,b)=>b.lastOpened-a.lastOpened):[]}catch{return []}}
function remember(token:string,name:string){const rest=readRecent().filter(p=>p.token!==token);localStorage.setItem(KEY,JSON.stringify([{token,name,lastOpened:Date.now()},...rest]));}
export default function Home(){
const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[recent,setRecent]=useState<Recent[]>([]),[shareUrl,setShareUrl]=useState('');
const router=useRouter();
useEffect(()=>setRecent(readRecent()),[]);
async function create(){setBusy(true);setError('');try{const r=await fetch('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const d=await r.json();if(!r.ok)throw Error(d.error||'作成できませんでした');remember(d.token,name.trim()||'新しいプロジェクト');router.push('/b/'+d.token)}catch(e){setError(String(e))}finally{setBusy(false)}}
function openExisting(){try{const u=new URL(shareUrl.trim());if(u.origin!==location.origin)throw Error('TaskBoxの共有URLを入力してください');const m=u.pathname.match(/^\/b\/([a-f0-9]{64})\/?$/);if(!m)throw Error('有効なプロジェクトURLを入力してください');router.push('/b/'+m[1])}catch(e){setError(String(e))}}
function forget(token:string){const next=readRecent().filter(p=>p.token!==token);localStorage.setItem(KEY,JSON.stringify(next));setRecent(next)}
return <main className="home"><div className="home-card"><div className="logo">▦ TaskBox</div><h1>みんなのタスクを、<br/>自由なボードに。</h1><p>カードを動かして整理。URLを送るだけで共同編集できます。</p>
<section className="recent-projects"><h2>保存済みのプロジェクト</h2>{recent.length?<div className="recent-list">{recent.map(p=><div className="recent-item" key={p.token}><button className="recent-open" onClick={()=>router.push('/b/'+p.token)}><strong>{p.name}</strong><span>開く →</span></button><button className="recent-remove" aria-label={p.name+'を一覧から外す'} title="この端末の一覧から外す" onClick={()=>forget(p.token)}>×</button></div>)}</div>:<p className="recent-empty">この端末に保存されたプロジェクトはまだありません。</p>}
<label htmlFor="existing-url">別の端末で作ったプロジェクトを追加</label><div className="existing-url-row"><input id="existing-url" value={shareUrl} onChange={e=>setShareUrl(e.target.value)} placeholder="共有URLを貼り付け"/><button onClick={openExisting}>開く</button></div><small>一度開いたプロジェクトは、この端末の一覧に保存されます。</small></section>
<section className="new-project"><h2>新しいプロジェクトを作成</h2><label htmlFor="project-name">プロジェクト名</label><input id="project-name" value={name} onChange={e=>setName(e.target.value)} placeholder="例：イベント準備" maxLength={100}/><button className="create-project" onClick={create} disabled={busy}>{busy?'作成中…':'プロジェクトを作成 →'}</button></section>{error&&<p className="error">{error}</p>}<small>ログイン不要 · URLを知っている人は編集できます。プロジェクト本体はクラウドに保存されます。</small></div></main>}
