"use client";
// @ts-nocheck

export const API = "https://api.stateofundeadpurge.site:8443";

export const HUNT_TYPES = ["food","medic","ammo","weapons","military","misc","beginner","horde"];
export const HUNT_REGIONS = ["Irvington","Echo Creek","Ekron","Brandenburg","Riverside","Fallas Lake","Rosewood","March Ridge","Muldraugh","Westpoint","Valley Station","Louisville","Grapeseed","Maplewood","Near Foxtrot","Frog Town","Raccoon City"];

/* ═══ HELPERS ═══ */
export const fmt = (n) => (n != null ? Number(n).toLocaleString() : "—");
export const bronzeToCoins = (b) => {
  if (b == null) return "—";
  const G=10000,S=1000,p=[]; let r=Math.abs(b);
  if(r>=G){p.push(`${Math.floor(r/G)}🟡`);r%=G}
  if(r>=S){p.push(`${Math.floor(r/S)}⚪`);r%=S}
  if(r>0||!p.length)p.push(`${r}🟤`);
  return (b<0?"−":"")+p.join(" ");
};
export const relTime = (ts) => {
  if(!ts)return"—";const s=Math.floor(Date.now()/1000-(ts>1e12?ts/1000:ts));
  if(s<0)return"just now";if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;
  if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;
};
export const fmtDate = (ts) => { if(!ts)return"—"; return new Date(ts>1e12?ts:ts*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
export const fmtFull = (ts) => { if(!ts)return"—"; return new Date(ts>1e12?ts:ts*1000).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); };

export const fetchApi = async (path, opts={}) => {
  const r = await fetch(`${API}${path}`, {credentials:"include",...opts});
  if(!r.ok){const e=await r.json().catch(()=>({detail:r.statusText}));throw new Error(e.detail||r.statusText)}
  return r.json();
};
export const postApi = (path, body) => fetchApi(path, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});

/* ═══ REUSABLE UI ═══ */
export const Toasts = ({items}) => <div className="ap-tbox">{items.map(t=><div key={t.id} className={`ap-toast ap-toast-${t.type}`}>{t.msg}</div>)}</div>;
export const SC = ({label,value,color,sub}) => <div className={`ap-sc ${color||""}`}><div className="ap-sc-l">{label}</div><div className="ap-sc-v">{value}</div>{sub&&<div className="ap-sc-s">{sub}</div>}</div>;
export const Title = ({t,s}) => <><div className="ap-title">{t}</div><div className="ap-sub">{s}</div></>;
export const TW = ({title,right,children}) => <div className="ap-tw"><div className="ap-tw-h"><h3>{title}</h3><div style={{flex:1}}/>{right}</div>{children}</div>;
export const B = ({c="gold",sm,full,children,...p}) => <button className={`ap-b ap-b-${c}${sm?" ap-b-sm":""}${full?" ap-b-full":""}`} {...p}>{children}</button>;
export const Inp = ({label,...p}) => <div className="ap-fg">{label&&<label className="ap-fl">{label}</label>}<input className="ap-inp" {...p}/></div>;
export const Sel = ({label,children,...p}) => <div className="ap-fg">{label&&<label className="ap-fl">{label}</label>}<select className="ap-sel" {...p}>{children}</select></div>;
export const TA = ({label,...p}) => <div className="ap-fg">{label&&<label className="ap-fl">{label}</label>}<textarea className="ap-ta" {...p}/></div>;
export const FB = ({title,children}) => <div className="ap-fb">{title&&<h4>{title}</h4>}{children}</div>;
export const Empty = ({text="No data"}) => <div className="ap-empty">{text}</div>;
export const Load = () => <div className="ap-load"><span>LOADING...</span></div>;
export const Toggle = ({on,onClick}) => <div className={`ap-tog ${on?"on":""}`} onClick={onClick}/>;
export const EvBadge = ({type}) => <span className={`ap-ev ap-ev-${type}`}>{type}</span>;
