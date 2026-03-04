"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const API = "https://api.stateofundeadpurge.site:8443";

/* ═══ NAV CONFIG ═══ */
const NAV_SECTIONS = [
  { label:"COMMAND", items:[
    { key:"overview", icon:"📡", label:"Overview" },
    { key:"server",   icon:"🖥️", label:"Server" },
  ]},
  { label:"ECONOMY", items:[
    { key:"shop",     icon:"📦", label:"Shop" },
    { key:"treasury", icon:"🏦", label:"Treasury" },
    { key:"economy",  icon:"💰", label:"Wallets" },
  ]},
  { label:"WORLD", items:[
    { key:"dotd",     icon:"💀", label:"Dawn of Dead" },
    { key:"hunt",     icon:"🗺️", label:"Treasure Hunt" },
  ]},
  { label:"COMMUNITY", items:[
    { key:"players",  icon:"👥", label:"Players" },
    { key:"games",    icon:"🎮", label:"Games" },
    { key:"mods",     icon:"🔧", label:"Mods & Broadcast" },
  ]},
];

// Real hunt types from treasure_hunt_data.py
const HUNT_TYPES = ["food","medic","ammo","weapons","military","misc","beginner","horde"];
// Real regions from LOCATIONS dict
const HUNT_REGIONS = ["Irvington","Echo Creek","Ekron","Brandenburg","Riverside","Fallas Lake","Rosewood","March Ridge","Muldraugh","Westpoint","Valley Station","Louisville","Grapeseed","Maplewood","Near Foxtrot","Frog Town","Raccoon City"];

/* ═══ CSS ═══ */
const CSS = `
:root{--bg:#080a0c;--surface:#0f1318;--surface2:#141a21;--border:#1e2530;--accent:#c8a84b;--accent2:#7b3f3f;--red:#e05555;--green:#4caf7d;--blue:#4a8fc4;--orange:#d4873a;--purple:#9775cc;--muted:#4a5568;--text:#c8cdd6;--textdim:#6b7280;--mono:'Share Tech Mono',monospace;--display:'Bebas Neue',sans-serif;--body:'Inter',-apple-system,sans-serif}
.ap{font-family:var(--body);background:var(--bg);color:var(--text);min-height:100vh;font-size:14px;position:relative}
.ap::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);pointer-events:none;z-index:1000}

.ap-hd{display:flex;align-items:center;gap:16px;padding:14px 28px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:100}
.ap-logo{font-family:var(--display);font-size:26px;letter-spacing:3px;color:var(--accent);text-shadow:0 0 20px rgba(200,168,75,0.35);user-select:none}
.ap-hd-badge{font-family:var(--mono);font-size:9px;padding:3px 8px;background:var(--accent2);color:#fff;letter-spacing:2px;border-radius:2px}
.ap-hd-right{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--textdim);display:flex;align-items:center;gap:16px}
.ap-hd-right .on{color:var(--green)} .ap-hd-right .off{color:var(--red)}

.ap-shell{display:grid;grid-template-columns:210px 1fr;min-height:calc(100vh - 53px)}
.ap-nav{background:var(--surface);border-right:1px solid var(--border);padding:16px 0;position:sticky;top:53px;height:calc(100vh - 53px);overflow-y:auto}
.ap-nav::-webkit-scrollbar{width:4px} .ap-nav::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.ap-nav-sec{padding:12px 20px 4px;font-size:9px;letter-spacing:2.5px;color:var(--muted);text-transform:uppercase;font-family:var(--mono)}
.ap-nav-div{height:1px;background:var(--border);margin:12px 20px}
.ap-nav-a{display:flex;align-items:center;gap:10px;padding:9px 20px;color:var(--textdim);font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:500;cursor:pointer;transition:all .15s;border-left:2px solid transparent;user-select:none}
.ap-nav-a:hover{color:var(--text);background:rgba(255,255,255,0.02)}
.ap-nav-a.act{color:var(--accent);border-left-color:var(--accent);background:rgba(200,168,75,0.05)}
.ap-nav-ico{font-size:15px;width:20px;text-align:center;flex-shrink:0}
.ap-nav-back{display:flex;align-items:center;gap:8px;padding:9px 20px;color:var(--textdim);font-size:11px;letter-spacing:1px;cursor:pointer;transition:color .15s;text-decoration:none;font-family:var(--mono)}
.ap-nav-back:hover{color:var(--text)}

.ap-main{padding:32px;overflow-y:auto;min-width:0}

.ap-title{font-family:var(--display);font-size:36px;letter-spacing:4px;color:var(--accent);margin-bottom:4px;line-height:1}
.ap-sub{color:var(--textdim);font-size:12px;margin-bottom:28px;font-family:var(--mono)}

.ap-sr{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
.ap-sc{background:var(--surface);border:1px solid var(--border);padding:20px;position:relative;overflow:hidden;transition:border-color .2s}
.ap-sc:hover{border-color:rgba(200,168,75,0.15)}
.ap-sc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent)}
.ap-sc.red::before{background:var(--red)} .ap-sc.green::before{background:var(--green)}
.ap-sc.blue::before{background:var(--blue)} .ap-sc.orange::before{background:var(--orange)}
.ap-sc.purple::before{background:var(--purple)}
.ap-sc-l{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--textdim);font-family:var(--mono);margin-bottom:8px}
.ap-sc-v{font-family:var(--display);font-size:32px;letter-spacing:2px;color:var(--accent);line-height:1}
.ap-sc.red .ap-sc-v{color:var(--red)} .ap-sc.green .ap-sc-v{color:var(--green)}
.ap-sc.blue .ap-sc-v{color:var(--blue)} .ap-sc.orange .ap-sc-v{color:var(--orange)}
.ap-sc.purple .ap-sc-v{color:var(--purple)}
.ap-sc-s{font-size:11px;color:var(--textdim);margin-top:4px;font-family:var(--mono)}

.ap-tw{background:var(--surface);border:1px solid var(--border);overflow:hidden;margin-bottom:24px}
.ap-tw-h{display:flex;align-items:center;padding:14px 20px;border-bottom:1px solid var(--border);gap:12px;flex-wrap:wrap}
.ap-tw-h h3{font-family:var(--display);font-size:18px;letter-spacing:2px;color:var(--text);margin:0}

table.ap-t{width:100%;border-collapse:collapse}
.ap-t th{text-align:left;padding:10px 16px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--textdim);font-family:var(--mono);font-weight:400;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.2)}
.ap-t td{padding:10px 16px;border-bottom:1px solid rgba(30,37,48,0.5);vertical-align:middle}
.ap-t tr:hover td{background:rgba(255,255,255,0.015)}
.ap-t tr:last-child td{border-bottom:none}

.ap-b{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:11px;font-family:var(--mono);letter-spacing:1px;text-transform:uppercase;border:1px solid;cursor:pointer;background:transparent;transition:all .15s;border-radius:2px;white-space:nowrap}
.ap-b:disabled{opacity:.4;cursor:not-allowed}
.ap-b-gold{border-color:var(--accent);color:var(--accent)} .ap-b-gold:hover:not(:disabled){background:var(--accent);color:#000}
.ap-b-red{border-color:var(--red);color:var(--red)} .ap-b-red:hover:not(:disabled){background:var(--red);color:#fff}
.ap-b-green{border-color:var(--green);color:var(--green)} .ap-b-green:hover:not(:disabled){background:var(--green);color:#000}
.ap-b-blue{border-color:var(--blue);color:var(--blue)} .ap-b-blue:hover:not(:disabled){background:var(--blue);color:#fff}
.ap-b-ghost{border-color:var(--border);color:var(--textdim)} .ap-b-ghost:hover:not(:disabled){border-color:var(--muted);color:var(--text)}
.ap-b-orange{border-color:var(--orange);color:var(--orange)} .ap-b-orange:hover:not(:disabled){background:var(--orange);color:#000}
.ap-b-sm{padding:4px 10px;font-size:10px} .ap-b-full{width:100%;justify-content:center}

.ap-inp,.ap-sel{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 12px;font-family:var(--mono);font-size:13px;outline:none;border-radius:2px;transition:border-color .15s;width:100%}
.ap-inp:focus,.ap-sel:focus{border-color:var(--accent)} .ap-sel option{background:var(--surface)}
.ap-ta{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px 14px;font-family:var(--mono);font-size:13px;outline:none;border-radius:2px;transition:border-color .15s;width:100%;resize:vertical;min-height:80px}
.ap-ta:focus{border-color:var(--accent)}

.ap-fg{display:flex;flex-direction:column;gap:6px;margin-bottom:16px} .ap-fg:last-child{margin-bottom:0}
.ap-fl{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--textdim);font-family:var(--mono)}
.ap-fgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px}

.ap-fb{background:var(--surface);border:1px solid var(--border);padding:24px;margin-bottom:24px}
.ap-fb h4{font-family:var(--display);font-size:18px;letter-spacing:2px;color:var(--text);margin:0 0 20px 0}

.ap-note{font-family:var(--mono);font-size:11px;color:var(--textdim);padding:10px 14px;background:rgba(200,168,75,0.04);border:1px solid rgba(200,168,75,0.12);border-radius:2px;margin-bottom:16px;line-height:1.7}
.ap-note.danger{background:rgba(224,85,85,0.05);border-color:rgba(224,85,85,0.2);color:var(--red)}
.ap-note.info{background:rgba(74,143,196,0.05);border-color:rgba(74,143,196,0.15);color:var(--blue)}
.ap-note.success{background:rgba(76,175,125,0.05);border-color:rgba(76,175,125,0.2);color:var(--green)}

.ap-2c{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.ap-3c{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}
.ap-inline{display:flex;gap:10px;align-items:flex-end} .ap-inline .ap-fg{flex:1;margin-bottom:0}

.ap-pill{display:inline-block;padding:2px 8px;font-size:10px;font-family:var(--mono);letter-spacing:1px;border-radius:2px}
.ap-tier-common{background:rgba(107,114,128,0.2);color:#9ca3af}
.ap-tier-uncommon{background:rgba(76,143,125,0.2);color:#4caf7d}
.ap-tier-rare{background:rgba(74,143,196,0.2);color:#4a8fc4}
.ap-tier-epic{background:rgba(123,63,63,0.2);color:#c47a4a}
.ap-tier-legendary{background:rgba(200,168,75,0.2);color:var(--accent)}
.ap-cat{font-size:10px;padding:2px 6px;background:rgba(255,255,255,0.05);color:var(--textdim);font-family:var(--mono);border-radius:2px}
.ap-dot{display:inline-block;width:8px;height:8px;border-radius:50%}
.ap-dot.on{background:var(--green);box-shadow:0 0 6px var(--green)} .ap-dot.off{background:var(--muted)}

.ap-ev{display:inline-block;padding:2px 7px;font-size:10px;font-family:var(--mono);letter-spacing:1px;border-radius:2px;text-transform:uppercase}
.ap-ev-payout{background:rgba(76,175,125,0.15);border:1px solid rgba(76,175,125,0.3);color:var(--green)}
.ap-ev-burn{background:rgba(224,85,85,0.12);border:1px solid rgba(224,85,85,0.3);color:var(--red)}
.ap-ev-recycle{background:rgba(212,135,58,0.12);border:1px solid rgba(212,135,58,0.3);color:var(--orange)}
.ap-ev-reset{background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);color:var(--accent)}
.ap-ev-adjust{background:rgba(74,143,196,0.12);border:1px solid rgba(74,143,196,0.3);color:var(--blue)}
.ap-ev-admin_grant{background:rgba(76,175,125,0.15);border:1px solid rgba(76,175,125,0.3);color:var(--green)}
.ap-ev-admin_take{background:rgba(224,85,85,0.12);border:1px solid rgba(224,85,85,0.3);color:var(--red)}
.ap-ev-treasury_payout{background:rgba(76,175,125,0.15);border:1px solid rgba(76,175,125,0.3);color:var(--green)}
.ap-ev-purchase{background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);color:var(--accent)}
.ap-ev-sell{background:rgba(212,135,58,0.12);border:1px solid rgba(212,135,58,0.3);color:var(--orange)}

.ap-search{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:7px 14px;font-family:var(--mono);font-size:12px;outline:none;border-radius:2px;width:220px;transition:border-color .15s}
.ap-search:focus{border-color:var(--accent)}

.ap-ft{padding:4px 12px;border-radius:2px;border:1px solid var(--border);background:transparent;color:var(--textdim);font-family:var(--mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:all .15s}
.ap-ft.act{border-color:var(--accent);color:var(--accent);background:rgba(200,168,75,0.05)}
.ap-ft:hover:not(.act){color:var(--text)}

.ap-lr{display:flex;gap:14px;align-items:center;padding:8px 16px;border-bottom:1px solid rgba(30,37,48,0.5);font-family:var(--mono);font-size:11px}
.ap-lr:hover{background:rgba(255,255,255,0.015)}
.ap-lr-t{color:var(--textdim);min-width:80px}
.ap-lr-d{color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ap-lr-p{color:var(--textdim);min-width:100px}
.ap-lr-v{min-width:90px;text-align:right}
.ap-lr-v.pos{color:var(--green)} .ap-lr-v.neg{color:var(--red)} .ap-lr-v.neu{color:var(--accent)}

.ap-hero{background:var(--surface);border:1px solid var(--border);padding:28px 32px;margin-bottom:28px;position:relative;overflow:hidden}
.ap-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent)}
.ap-hero-g{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:start}
.ap-big{font-family:var(--display);font-size:56px;letter-spacing:4px;color:var(--accent);text-shadow:0 0 30px rgba(200,168,75,0.3);line-height:1}
.ap-big.dep{color:var(--red);text-shadow:0 0 20px rgba(224,85,85,0.4)}
.ap-big.low{color:var(--orange);text-shadow:0 0 20px rgba(212,135,58,0.3)}

.ap-hbar{height:4px;background:rgba(255,255,255,0.05);border:1px solid var(--border);overflow:hidden;margin:16px 0 6px}
.ap-hfill{height:100%;background:var(--green);box-shadow:0 0 8px rgba(76,175,125,0.4);transition:width .7s ease,background .4s}
.ap-hfill.amber{background:var(--orange);box-shadow:0 0 8px rgba(212,135,58,0.4)}
.ap-hfill.red{background:var(--red);box-shadow:0 0 8px rgba(224,85,85,0.5);animation:ap-pulse 1s infinite}
@keyframes ap-pulse{0%,100%{opacity:1}50%{opacity:.5}}

.ap-mbadge{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:2px;padding:4px 12px;border-radius:2px;margin-bottom:16px}
.ap-mbadge.A{background:rgba(224,85,85,0.1);border:1px solid rgba(224,85,85,0.3);color:var(--red)}
.ap-mbadge.B{background:rgba(76,175,125,0.1);border:1px solid rgba(76,175,125,0.3);color:var(--green)}
.ap-cyc{width:180px;height:3px;background:rgba(255,255,255,0.05);border:1px solid var(--border);overflow:hidden}
.ap-cyc-f{height:100%;background:var(--accent);transition:width .7s}

.ap-alert{display:flex;align-items:center;gap:12px;padding:12px 20px;margin-bottom:24px;font-family:var(--mono);font-size:11px;letter-spacing:1px;border-left:3px solid}
.ap-alert.dep{background:rgba(224,85,85,0.07);border-color:var(--red);color:var(--red)}
.ap-alert.low{background:rgba(212,135,58,0.07);border-color:var(--orange);color:var(--orange)}

.ap-mbd{position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:500;display:flex;align-items:center;justify-content:center}
.ap-mod{background:var(--surface);border:1px solid var(--accent);padding:32px;width:560px;max-width:90vw;max-height:85vh;overflow-y:auto;position:relative}
.ap-mod h3{font-family:var(--display);font-size:24px;letter-spacing:3px;color:var(--accent);margin:0 0 24px 0}
.ap-mod-x{position:absolute;top:16px;right:16px;background:none;border:none;color:var(--textdim);font-size:20px;cursor:pointer}
.ap-mod-x:hover{color:var(--text)}

.ap-pre{padding:3px 10px;border-radius:2px;border:1px solid var(--border);background:transparent;color:var(--textdim);font-family:var(--mono);font-size:10px;letter-spacing:1px;cursor:pointer;transition:all .15s}
.ap-pre:hover{border-color:var(--accent);color:var(--accent)}

.ap-tbox{position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:8px;z-index:9999;pointer-events:none}
.ap-toast{padding:12px 20px;font-family:var(--mono);font-size:12px;letter-spacing:1px;border-left:3px solid;background:var(--surface);animation:ap-slide .2s ease;max-width:360px;pointer-events:auto}
.ap-toast-success{border-color:var(--green);color:var(--green)}
.ap-toast-error{border-color:var(--red);color:var(--red)}
.ap-toast-info{border-color:var(--accent);color:var(--accent)}
@keyframes ap-slide{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}

.ap-se{display:flex;align-items:center;gap:8px}
.ap-se input{width:65px;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;font-family:var(--mono);font-size:12px;text-align:center;border-radius:2px;outline:none;transition:border-color .15s}
.ap-se input:focus{border-color:var(--accent)}

.ap-tog{width:42px;height:22px;background:var(--border);border-radius:11px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.ap-tog.on{background:var(--green)}
.ap-tog::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s}
.ap-tog.on::after{transform:translateX(20px)}

.ap-sl{display:flex;align-items:center;gap:16px;margin-bottom:16px}
.ap-sl label{font-family:var(--mono);font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--textdim);min-width:150px}
.ap-sl input[type="range"]{flex:1;accent-color:var(--accent);height:4px}
.ap-sl .ap-sl-v{font-family:var(--mono);font-size:13px;color:var(--accent);min-width:60px;text-align:right}

.ap-srv-dot{width:12px;height:12px;border-radius:50%}
.ap-srv-dot.running{background:var(--green);box-shadow:0 0 10px var(--green);animation:ap-glow 2s infinite}
.ap-srv-dot.stopped{background:var(--red);box-shadow:0 0 10px var(--red)}
.ap-srv-dot.unknown{background:var(--muted)}
@keyframes ap-glow{0%,100%{box-shadow:0 0 10px var(--green)}50%{box-shadow:0 0 20px var(--green)}}

.ap-term{background:var(--bg);border:1px solid var(--border);padding:16px;font-family:var(--mono);font-size:12px;max-height:220px;overflow-y:auto;color:var(--textdim)}
.ap-term-line{margin-bottom:4px} .ap-term-line.cmd{color:var(--accent)} .ap-term-line.ok{color:var(--green)} .ap-term-line.err{color:var(--red)}

.ap-empty{text-align:center;color:var(--textdim);padding:40px;font-family:var(--mono);font-size:12px}
.ap-load{text-align:center;padding:40px} .ap-load span{font-family:var(--mono);font-size:12px;color:var(--textdim);letter-spacing:2px;animation:ap-blink 1.2s infinite}
@keyframes ap-blink{0%,100%{opacity:.3}50%{opacity:1}}

@media(max-width:1100px){
  .ap-shell{grid-template-columns:1fr} .ap-nav{display:none}
  .ap-sr{grid-template-columns:repeat(2,1fr)} .ap-2c,.ap-3c{grid-template-columns:1fr}
  .ap-hero-g{grid-template-columns:1fr} .ap-fgrid{grid-template-columns:1fr}
}
`;

/* ═══ HELPERS ═══ */
const fmt = (n) => (n != null ? Number(n).toLocaleString() : "—");
const bronzeToCoins = (b) => {
  if (b == null) return "—";
  const G=10000,S=1000,p=[]; let r=Math.abs(b);
  if(r>=G){p.push(`${Math.floor(r/G)}🟡`);r%=G}
  if(r>=S){p.push(`${Math.floor(r/S)}⚪`);r%=S}
  if(r>0||!p.length)p.push(`${r}🟤`);
  return (b<0?"−":"")+p.join(" ");
};
const relTime = (ts) => {
  if(!ts)return"—";const s=Math.floor(Date.now()/1000-(ts>1e12?ts/1000:ts));
  if(s<0)return"just now";if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;
  if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;
};
const fmtDate = (ts) => { if(!ts)return"—"; return new Date(ts>1e12?ts:ts*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtFull = (ts) => { if(!ts)return"—"; return new Date(ts>1e12?ts:ts*1000).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); };

const fetchApi = async (path, opts={}) => {
  const r = await fetch(`${API}${path}`, {credentials:"include",...opts});
  if(!r.ok){const e=await r.json().catch(()=>({detail:r.statusText}));throw new Error(e.detail||r.statusText)}
  return r.json();
};
const postApi = (path, body) => fetchApi(path, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});

/* ═══ REUSABLE UI ═══ */
const Toasts = ({items}) => <div className="ap-tbox">{items.map(t=><div key={t.id} className={`ap-toast ap-toast-${t.type}`}>{t.msg}</div>)}</div>;
const SC = ({label,value,color,sub}) => <div className={`ap-sc ${color||""}`}><div className="ap-sc-l">{label}</div><div className="ap-sc-v">{value}</div>{sub&&<div className="ap-sc-s">{sub}</div>}</div>;
const Title = ({t,s}) => <><div className="ap-title">{t}</div><div className="ap-sub">{s}</div></>;
const TW = ({title,right,children}) => <div className="ap-tw"><div className="ap-tw-h"><h3>{title}</h3><div style={{flex:1}}/>{right}</div>{children}</div>;
const B = ({c="gold",sm,full,children,...p}) => <button className={`ap-b ap-b-${c}${sm?" ap-b-sm":""}${full?" ap-b-full":""}`} {...p}>{children}</button>;
const Inp = ({label,...p}) => <div className="ap-fg">{label&&<label className="ap-fl">{label}</label>}<input className="ap-inp" {...p}/></div>;
const Sel = ({label,children,...p}) => <div className="ap-fg">{label&&<label className="ap-fl">{label}</label>}<select className="ap-sel" {...p}>{children}</select></div>;
const TA = ({label,...p}) => <div className="ap-fg">{label&&<label className="ap-fl">{label}</label>}<textarea className="ap-ta" {...p}/></div>;
const FB = ({title,children}) => <div className="ap-fb">{title&&<h4>{title}</h4>}{children}</div>;
const Empty = ({text="No data"}) => <div className="ap-empty">{text}</div>;
const Load = () => <div className="ap-load"><span>LOADING...</span></div>;
const Toggle = ({on,onClick}) => <div className={`ap-tog ${on?"on":""}`} onClick={onClick}/>;
const EvBadge = ({type}) => {
  const cls = `ap-ev ap-ev-${type}` ;
  return <span className={cls}>{type}</span>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. OVERVIEW
   ═══════════════════════════════════════════════════════════════════════════ */
const OverviewPanel = ({toast}) => {
  const [d,setD]=useState(null);const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    try{const[tres,shopR,comR]=await Promise.allSettled([fetchApi("/api/treasury/admin/overview"),fetchApi("/api/admin/shop/items"),fetchApi("/api/community")]);
    setD({t:tres.status==="fulfilled"?tres.value:null,shop:shopR.status==="fulfilled"?shopR.value:null,com:comR.status==="fulfilled"?comR.value:null})}catch{}
    setLoading(false);
  },[]);
  useEffect(()=>{load();const iv=setInterval(load,30000);return()=>clearInterval(iv)},[load]);
  if(loading)return<Load/>;
  const t=d?.t?.treasury,s24=d?.t?.stats_24h,items=d?.shop?.items||[],com=d?.com,log=d?.t?.recent_log||[],oos=items.filter(i=>i.stock===0).length;
  return(<>
    <Title t="COMMAND CENTER" s="system overview · treasury health · recent activity"/>
    <div className="ap-sr">
      <SC label="Treasury Balance" value={t?fmt(t.balance):"—"} sub={t?`${t.health_pct}% health`:""}/>
      <SC label="Paid Out (24h)" value={s24?fmt(s24.paid_out):"—"} color="green" sub={s24?`${s24.payout_count} payouts`:""}/>
      <SC label="Shop Items" value={items.filter(i=>i.enabled).length||"—"} color="blue" sub={`${oos} out of stock`}/>
      <SC label="Total Players" value={com?.total_players??"—"} color="orange" sub={com?.online_count?`${com.online_count} online`:""}/>
    </div>
    {t&&<div className="ap-hero" style={{marginBottom:28}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:3,color:"var(--textdim)",textTransform:"uppercase",marginBottom:6}}>Treasury Status</div>
          <div style={{fontFamily:"var(--display)",fontSize:42,letterSpacing:3,color:t.balance===0?"var(--red)":t.health_pct<20?"var(--orange)":"var(--accent)",lineHeight:1}}>{fmt(t.balance)} <span style={{fontSize:18,color:"var(--textdim)"}}>🟤</span></div>
          <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--textdim)",marginTop:4}}>{bronzeToCoins(t.balance)}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div className={`ap-mbadge ${t.model}`}>{t.model==="B"?"♻ MODEL B — CIRCULATING":"🔥 MODEL A — HARD CAP"}</div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:2,color:"var(--textdim)",textTransform:"uppercase"}}>Cycle</div>
          <div style={{fontFamily:"var(--display)",fontSize:24,letterSpacing:2,color:"var(--text)"}}>{t.cycle_days_remaining>0?`${t.cycle_days_remaining}d left`:"OVERDUE"}</div>
        </div>
      </div>
      <div className="ap-hbar"><div className={`ap-hfill ${t.health_pct<10?"red":t.health_pct<25?"amber":""}`} style={{width:`${t.health_pct}%`}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--mono)",fontSize:10,color:"var(--textdim)"}}><span>{t.health_pct}% of cap</span><span>Cap: {fmt(t.cap)} 🟤</span></div>
    </div>}
    <TW title="RECENT ACTIVITY" right={<B c="ghost" sm onClick={load}>↻ Refresh</B>}>
      {log.length?<div>{log.slice(0,12).map((e,i)=><div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type}/>
        <span className="ap-lr-d">{e.reason||"—"}</span>
        <span className="ap-lr-p">{e.player||(e.discord_id?`#${e.discord_id}`:"—")}</span>
        <span className={`ap-lr-v ${["payout","burn"].includes(e.event_type)?"neg":e.amount>0?"pos":"neu"}`}>{["payout","burn"].includes(e.event_type)?"−":e.amount>0?"+":""}{fmt(Math.abs(e.amount))} 🟤</span>
      </div>)}</div>:<Empty text="no events yet"/>}
    </TW>
  </>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. SERVER CONTROL
   ═══════════════════════════════════════════════════════════════════════════ */
const ServerPanel = ({toast}) => {
  const [sub,setSub]=useState("status");
  const [serverUp,setServerUp]=useState(null);
  const [termLog,setTermLog]=useState([]);
  const [loading,setLoading]=useState(false);
  const addLog=(text,type="ok")=>setTermLog(prev=>[...prev.slice(-49),{text,type}]);

  const checkHealth=useCallback(async()=>{try{const r=await fetch(`${API}/health`,{credentials:"include"});setServerUp(r.ok)}catch{setServerUp(false)}},[]);
  useEffect(()=>{checkHealth()},[checkHealth]);

  const serverAction=async(action)=>{
    setLoading(true);addLog(`> ${action}`,"cmd");
    try{const res=await postApi(`/api/admin/server/${action}`,{});addLog(res.message||res.response||"OK","ok");toast(`${action} complete`,"success")}
    catch(e){addLog(`ERROR: ${e.message}`,"err");toast(`Failed: ${e.message}`,"error")}
    setLoading(false);
  };

  const tabs=[{key:"status",icon:"📡",label:"Status"},{key:"controls",icon:"⚙️",label:"Controls"},{key:"rcon",icon:"💻",label:"RCON"},{key:"items",icon:"🎁",label:"Give Items"}];
  return(<>
    <Title t="SERVER ADMIN" s="status · rcon · player management"/>
    <div style={{display:"flex",gap:6,marginBottom:24}}>{tabs.map(t=><button key={t.key} className={`ap-ft ${sub===t.key?"act":""}`} onClick={()=>setSub(t.key)}>{t.icon} {t.label}</button>)}</div>
    {sub==="status"&&<>
      <div className="ap-sr" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        <div className="ap-sc" style={{display:"flex",alignItems:"center",gap:16}}>
          <div className={`ap-srv-dot ${serverUp===true?"running":serverUp===false?"stopped":"unknown"}`}/>
          <div><div className="ap-sc-l">Game Server</div><div style={{fontFamily:"var(--display)",fontSize:24,letterSpacing:2,color:serverUp?"var(--green)":serverUp===false?"var(--red)":"var(--textdim)"}}>{serverUp===true?"ONLINE":serverUp===false?"OFFLINE":"CHECKING..."}</div></div>
        </div>
        <SC label="Bot API" value="ONLINE" color="green" sub="api.stateofundeadpurge.site"/>
        <div className="ap-sc blue" style={{display:"flex",alignItems:"center",justifyContent:"center"}}><B c="ghost" sm onClick={checkHealth}>↻ Refresh</B></div>
      </div>
      <div className="ap-note info">ℹ Server start/stop/restart controls require additional VPS endpoints to be set up.</div>
    </>}
    {sub==="controls"&&<div className="ap-2c">
      <FB title="SERVER CONTROLS">
        <div className="ap-note danger">⚠ These directly affect the live server. Players will be disconnected during restart/stop.</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
          <B c="orange" disabled={loading} onClick={()=>serverAction("restart")}>🔄 Restart</B>
          <B c="blue" disabled={loading} onClick={()=>serverAction("save")}>💾 Save World</B>
        </div>
      </FB>
      <FB title="QUICK BROADCASTS">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {["Server restarting in 5 minutes","Server restarting in 1 minute","Maintenance starting soon","Event starting! Check Discord!"].map((msg,i)=>(
            <button key={i} className="ap-pre" style={{textAlign:"left",padding:10}} onClick={async()=>{try{await postApi("/api/admin/server/broadcast",{message:msg});toast("Sent!","success")}catch(e){toast(e.message,"error")}}}>{msg}</button>
          ))}
        </div>
      </FB>
      {termLog.length>0&&<div style={{gridColumn:"1/-1"}}><FB title="TERMINAL"><div className="ap-term">{termLog.map((l,i)=><div key={i} className={`ap-term-line ${l.type}`}>{l.text}</div>)}</div></FB></div>}
    </div>}
    {sub==="rcon"&&<RconConsole toast={toast} addLog={addLog} termLog={termLog}/>}
    {sub==="items"&&<GiveItemPanel toast={toast}/>}
  </>);
};

const RconConsole = ({toast,addLog,termLog}) => {
  const [cmd,setCmd]=useState("");const termRef=useRef(null);
  useEffect(()=>{if(termRef.current)termRef.current.scrollTop=termRef.current.scrollHeight},[termLog]);
  const runCmd=async()=>{if(!cmd.trim())return;addLog(`> ${cmd}`,"cmd");try{const res=await postApi("/api/admin/server/rcon",{command:cmd});addLog(res.response||"OK","ok")}catch(e){addLog(`ERROR: ${e.message}`,"err")}setCmd("")};
  const quickCmds=[{label:"Players",cmd:"players"},{label:"Save",cmd:"save"},{label:"Chopper",cmd:"chopper"},{label:"Gunshot",cmd:"gunshot"},{label:"Start Rain",cmd:"startrain"},{label:"Stop Rain",cmd:"stoprain"}];
  return(<FB title="RCON CONSOLE">
    <div className="ap-note danger">⚠ Direct RCON. Commands sent to game server as-is.</div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{quickCmds.map((q,i)=><button key={i} className="ap-pre" onClick={()=>setCmd(q.cmd)}>{q.label}</button>)}</div>
    <div className="ap-inline"><Inp placeholder="type RCON command..." value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")runCmd()}}/><B c="gold" onClick={runCmd}>Execute</B></div>
    <div className="ap-term" ref={termRef} style={{marginTop:16}}>
      {termLog.length===0?<div className="ap-term-line" style={{color:"var(--muted)"}}>// terminal ready</div>:termLog.map((l,i)=><div key={i} className={`ap-term-line ${l.type}`}>{l.text}</div>)}
    </div>
  </FB>);
};

const GiveItemPanel = ({toast}) => {
  const [player,setPlayer]=useState("");const [itemId,setItemId]=useState("");const [count,setCount]=useState("1");
  const give=async()=>{if(!player||!itemId){toast("Player and item required","error");return}try{await postApi("/api/admin/server/rcon",{command:`additem "${player}" "${itemId}" ${count||1}`});toast(`Gave ${count}x ${itemId} to ${player}`,"success")}catch(e){toast(`Failed: ${e.message}`,"error")}};
  const presets=[{label:"Katana",id:"Base.Katana"},{label:"Axe",id:"Base.Axe"},{label:"Shotgun",id:"Base.Shotgun"},{label:"Antibiotics",id:"Base.Antibiotics"},{label:"Generator",id:"Base.Generator"},{label:"Gas Can",id:"Base.PetrolCan"},{label:"Sledgehammer",id:"Base.Sledgehammer"},{label:"First Aid Kit",id:"Base.FirstAidKit"}];
  return(<div className="ap-2c">
    <FB title="GIVE ITEM">
      <div className="ap-note">Player must be online. Uses RCON additem command.</div>
      <Inp label="Player (exact in-game name)" placeholder="SurvivorDave" value={player} onChange={e=>setPlayer(e.target.value)}/>
      <Inp label="Item ID" placeholder="Base.Katana" value={itemId} onChange={e=>setItemId(e.target.value)}/>
      <Inp label="Count" type="number" value={count} onChange={e=>setCount(e.target.value)}/>
      <B c="gold" onClick={give}>🎁 Give Item</B>
    </FB>
    <FB title="ITEM PRESETS">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{presets.map((p,i)=><button key={i} className="ap-pre" style={{padding:"8px 12px",textAlign:"left"}} onClick={()=>setItemId(p.id)}>{p.label}<br/><span style={{color:"var(--textdim)",fontSize:9}}>{p.id}</span></button>)}</div>
    </FB>
  </div>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. SHOP
   ═══════════════════════════════════════════════════════════════════════════ */
const ShopPanel = ({toast}) => {
  const [sub,setSub]=useState("inventory");const [items,setItems]=useState([]);const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);const [editItem,setEditItem]=useState(null);const [restockLog,setRestockLog]=useState([]);

  const loadItems=useCallback(async()=>{setLoading(true);try{setItems((await fetchApi("/api/admin/shop/items")).items||[])}catch(e){toast("Failed to load","error")}setLoading(false)},[toast]);
  useEffect(()=>{loadItems()},[loadItems]);
  const loadLog=useCallback(async()=>{try{setRestockLog((await fetchApi("/api/admin/shop/restock-log")).log||[])}catch{}},[]);

  const filtered=useMemo(()=>{if(!search)return items;const q=search.toLowerCase();return items.filter(i=>i.name.toLowerCase().includes(q)||i.item_id.toLowerCase().includes(q)||i.category?.toLowerCase().includes(q))},[items,search]);
  const stats=useMemo(()=>({total:items.length,empty:items.filter(i=>i.stock===0).length,low:items.filter(i=>i.stock>0&&i.stock<5).length,enabled:items.filter(i=>i.enabled).length}),[items]);

  const toggleItem=async(id,en)=>{try{await postApi("/api/admin/shop/toggle",{item_id:id,enabled:en});toast(en?"Enabled":"Disabled","success");loadItems()}catch{toast("Failed","error")}};
  const quickStock=async(id,val)=>{const n=parseInt(val);if(isNaN(n)||n<0)return;try{await postApi("/api/admin/shop/stock",{item_id:id,mode:"set",amount:n,note:"Quick edit"});toast("Stock updated","success");loadItems()}catch{toast("Failed","error")}};
  const triggerRestock=async()=>{if(!confirm("Trigger full Zombita restock?"))return;try{const d=await postApi("/api/admin/shop/restock-all",{note:"Admin triggered"});toast(`Restocked ${d.restocked?.length||0} items!`,"success");loadItems()}catch{toast("Restock failed","error")}};
  const saveEdit=async()=>{if(!editItem)return;try{await postApi("/api/admin/shop/item",{item_id:editItem.item_id,name:editItem.name,buy_price:parseInt(editItem.buy_price)||null,sell_price:parseInt(editItem.sell_price)||null,category:editItem.category,tier:editItem.tier,stock:editItem.stock,base_stock:parseInt(editItem.base_stock)??10,restock_interval_days:parseInt(editItem.restock_interval_days)??30,variance:parseFloat(editItem.variance)??0.3,enabled:editItem.enabled});toast("Item saved","success");setEditItem(null);loadItems()}catch(e){toast("Failed: "+e.message,"error")}};
  const [newItem,setNewItem]=useState({item_id:"",name:"",buy_price:"",sell_price:"",category:"weapons",tier:"common",stock:"5",base_stock:"5",restock_interval_days:"30",variance:"0.3"});
  const ni=newItem,sni=(k,v)=>setNewItem({...ni,[k]:v});
  const addItem=async()=>{if(!ni.item_id||!ni.name){toast("ID and name required","error");return}try{await postApi("/api/admin/shop/item",{...ni,buy_price:parseInt(ni.buy_price)||null,sell_price:parseInt(ni.sell_price)||null,stock:parseInt(ni.stock)||0,base_stock:parseInt(ni.base_stock)||0,restock_interval_days:parseInt(ni.restock_interval_days)||30,variance:parseFloat(ni.variance)||0.3,enabled:1});toast(`${ni.name} added!`,"success");setNewItem({item_id:"",name:"",buy_price:"",sell_price:"",category:"weapons",tier:"common",stock:"5",base_stock:"5",restock_interval_days:"30",variance:"0.3"});loadItems()}catch(e){toast(e.message,"error")}};
  const stColor=(s)=>s===-1?"var(--textdim)":s===0?"var(--red)":s<5?"var(--accent)":"var(--green)";
  const tabs=[{key:"inventory",icon:"📦",label:"Inventory"},{key:"add",icon:"➕",label:"Add Item"},{key:"restock",icon:"🔄",label:"Restock"},{key:"log",icon:"📋",label:"Stock Log"}];

  return(<>
    <Title t="SHOP" s="manage inventory · stock levels · pricing"/>
    <div style={{display:"flex",gap:6,marginBottom:24}}>{tabs.map(t=><button key={t.key} className={`ap-ft ${sub===t.key?"act":""}`} onClick={()=>{setSub(t.key);if(t.key==="log")loadLog()}}>{t.icon} {t.label}</button>)}</div>
    {sub==="inventory"&&<>
      <div className="ap-sr"><SC label="Total Items" value={stats.total}/><SC label="Out of Stock" value={stats.empty} color="red"/><SC label="Low Stock" value={stats.low} color="orange"/><SC label="Enabled" value={stats.enabled} color="green"/></div>
      <TW title="ITEMS" right={<><input className="ap-search" placeholder="search items..." value={search} onChange={e=>setSearch(e.target.value)}/><B c="gold" sm onClick={loadItems}>↻</B></>}>
        {loading?<Load/>:<table className="ap-t"><thead><tr><th style={{width:40}}>⚡</th><th>Item</th><th>Category</th><th>Tier</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Base</th><th>Actions</th></tr></thead>
        <tbody>{filtered.length===0?<tr><td colSpan={9}><Empty text="no items found"/></td></tr>:filtered.map(item=>
          <tr key={item.item_id}>
            <td><span className={`ap-dot ${item.enabled?"on":"off"}`}/></td>
            <td><div style={{fontWeight:500}}>{item.name}</div><div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--textdim)"}}>{item.item_id}</div></td>
            <td><span className="ap-cat">{item.category}</span></td>
            <td><span className={`ap-pill ap-tier-${item.tier||"common"}`}>{item.tier||"common"}</span></td>
            <td style={{fontFamily:"var(--mono)"}}>{item.buy_price!=null?`${fmt(item.buy_price)} 🟤`:"—"}</td>
            <td style={{fontFamily:"var(--mono)"}}>{item.sell_price!=null?`${fmt(item.sell_price)} 🟤`:"—"}</td>
            <td><div className="ap-se"><span style={{fontFamily:"var(--mono)",fontSize:13,color:stColor(item.stock)}}>{item.stock===-1?"∞":item.stock}</span><input type="number" defaultValue={item.stock===-1?"":item.stock} min="0" placeholder="—" onBlur={e=>{if(e.target.value!==""&&parseInt(e.target.value)!==item.stock)quickStock(item.item_id,e.target.value)}}/></div></td>
            <td style={{fontFamily:"var(--mono)",color:"var(--textdim)"}}>{item.base_stock===-1?"∞":item.base_stock}</td>
            <td><div style={{display:"flex",gap:6}}><B c="blue" sm onClick={()=>setEditItem({...item})}>Edit</B><B c={item.enabled?"red":"green"} sm onClick={()=>toggleItem(item.item_id,item.enabled?0:1)}>{item.enabled?"Off":"On"}</B></div></td>
          </tr>
        )}</tbody></table>}
      </TW>
    </>}
    {sub==="add"&&<FB title="ADD ITEM">
      <div className="ap-fgrid">
        <div style={{gridColumn:"1/3"}}><Inp label="Item ID" placeholder="Base.Katana" value={ni.item_id} onChange={e=>sni("item_id",e.target.value)}/></div>
        <Inp label="Display Name" placeholder="Katana" value={ni.name} onChange={e=>sni("name",e.target.value)}/>
        <Sel label="Category" value={ni.category} onChange={e=>sni("category",e.target.value)}><option value="food">Food</option><option value="medical">Medical</option><option value="tools">Tools</option><option value="weapons">Weapons</option><option value="misc">Misc</option></Sel>
        <Sel label="Tier" value={ni.tier} onChange={e=>sni("tier",e.target.value)}><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></Sel>
        <Inp label="Buy Price" type="number" placeholder="5000" value={ni.buy_price} onChange={e=>sni("buy_price",e.target.value)}/>
        <Inp label="Sell Price" type="number" placeholder="0" value={ni.sell_price} onChange={e=>sni("sell_price",e.target.value)}/>
        <Inp label="Stock" type="number" value={ni.stock} onChange={e=>sni("stock",e.target.value)}/>
        <Inp label="Base Stock" type="number" value={ni.base_stock} onChange={e=>sni("base_stock",e.target.value)}/>
        <Inp label="Restock Days" type="number" value={ni.restock_interval_days} onChange={e=>sni("restock_interval_days",e.target.value)}/>
        <Inp label="Variance (±%)" type="number" step="0.05" value={ni.variance} onChange={e=>sni("variance",e.target.value)}/>
      </div>
      <B c="gold" onClick={addItem}>➕ ADD TO SHOP</B>
    </FB>}
    {sub==="restock"&&<>
      <FB title="FULL RESTOCK"><div className="ap-note">⚡ Triggers Zombita restock on all enabled items. Random amounts within variance.</div><B c="gold" onClick={triggerRestock}>⚡ TRIGGER ZOMBITA RESTOCK</B></FB>
      <FB title="SINGLE ITEM"><SingleRestock items={items} toast={toast} onDone={loadItems}/></FB>
    </>}
    {sub==="log"&&<TW title="STOCK LOG" right={<B c="ghost" sm onClick={loadLog}>↻</B>}>
      {restockLog.length?<div>{restockLog.map((e,i)=>{const d=(e.new_stock||0)-(e.old_stock||0);return<div key={i} className="ap-lr"><span className="ap-lr-t">{fmtDate(e.timestamp)}</span><span style={{color:"var(--text)",flex:1}}>{e.name||e.item_id}</span><span className={`ap-pill ${e.restock_type==="auto"?"ap-tier-rare":"ap-tier-legendary"}`}>{e.restock_type}</span><span style={{color:"var(--textdim)",fontSize:11,flex:1,fontFamily:"var(--mono)"}}>{e.note||""}</span><span className={`ap-lr-v ${d<0?"neg":"pos"}`}>{d>=0?"+":""}{d} → {e.new_stock}</span></div>})}</div>:<Empty text="no log entries"/>}
    </TW>}
    {editItem&&<div className="ap-mbd" onClick={e=>{if(e.target===e.currentTarget)setEditItem(null)}}>
      <div className="ap-mod"><button className="ap-mod-x" onClick={()=>setEditItem(null)}>✕</button><h3>EDIT ITEM</h3>
      <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--textdim)",marginBottom:20}}>{editItem.name} — {editItem.item_id}</div>
      <div className="ap-fgrid">
        <Inp label="Buy Price" type="number" value={editItem.buy_price||""} onChange={e=>setEditItem({...editItem,buy_price:e.target.value})}/>
        <Inp label="Sell Price" type="number" value={editItem.sell_price||""} onChange={e=>setEditItem({...editItem,sell_price:e.target.value})}/>
        <Sel label="Tier" value={editItem.tier||"common"} onChange={e=>setEditItem({...editItem,tier:e.target.value})}><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></Sel>
        <Inp label="Base Stock" type="number" value={editItem.base_stock??""} onChange={e=>setEditItem({...editItem,base_stock:e.target.value})}/>
        <Inp label="Restock Days" type="number" value={editItem.restock_interval_days??""} onChange={e=>setEditItem({...editItem,restock_interval_days:e.target.value})}/>
        <Inp label="Variance" type="number" step="0.05" value={editItem.variance??""} onChange={e=>setEditItem({...editItem,variance:e.target.value})}/>
      </div>
      <div style={{display:"flex",gap:12,marginTop:16}}><B c="gold" onClick={saveEdit}>Save</B><B c="ghost" onClick={()=>setEditItem(null)}>Cancel</B></div>
      </div></div>}
  </>);
};

const SingleRestock = ({items,toast,onDone}) => {
  const [itemId,setItemId]=useState("");const [mode,setMode]=useState("set");const [amount,setAmount]=useState("10");
  const enabled=items.filter(i=>i.enabled);
  useEffect(()=>{if(enabled.length&&!itemId)setItemId(enabled[0]?.item_id||"")},[enabled.length]);
  const apply=async()=>{if(!itemId||isNaN(parseInt(amount))){toast("Fill fields","error");return}try{const d=await postApi("/api/admin/shop/stock",{item_id:itemId,mode,amount:parseInt(amount),note:"Admin restock"});toast(`Stock → ${d.new_stock}`,"success");onDone()}catch{toast("Failed","error")}};
  return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 100px",gap:16,alignItems:"end"}}>
    <Sel label="Item" value={itemId} onChange={e=>setItemId(e.target.value)}>{enabled.map(i=><option key={i.item_id} value={i.item_id}>{i.name} ({i.stock===-1?"∞":i.stock})</option>)}</Sel>
    <Sel label="Mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="set">Set exact</option><option value="add">Add to current</option></Sel>
    <Inp label="Amount" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/>
    <B c="green" onClick={apply}>Apply</B>
  </div>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. TREASURY
   ═══════════════════════════════════════════════════════════════════════════ */
const TreasuryPanel = ({toast}) => {
  const [sub,setSub]=useState("overview");const [data,setData]=useState(null);const [log,setLog]=useState([]);
  const [logFilter,setLogFilter]=useState(null);const [loading,setLoading]=useState(true);const [showReset,setShowReset]=useState(false);

  const loadOv=useCallback(async()=>{try{setData(await fetchApi("/api/treasury/admin/overview"))}catch{}setLoading(false)},[]);
  const loadLog=useCallback(async(f)=>{try{const qs=f?`&event_type=${f}`:"";setLog((await fetchApi(`/api/treasury/admin/log?limit=200${qs}`)).log||[])}catch{}},[]);
  useEffect(()=>{loadOv();const iv=setInterval(loadOv,20000);return()=>clearInterval(iv)},[loadOv]);

  const t=data?.treasury,s24=data?.stats_24h,rLog=data?.recent_log||[];
  const doAdjust=async(amt,reason)=>{try{await postApi("/api/treasury/admin/adjust",{amount:amt,reason:reason||"Admin"});toast(`Adjusted ${amt>0?"+":""}${fmt(amt)}`,"success");loadOv()}catch(e){toast("Failed: "+e.message,"error")}};
  const doConfig=async(body)=>{try{await postApi("/api/treasury/admin/config",body);toast("Updated","success");loadOv()}catch(e){toast("Failed: "+e.message,"error")}};
  const doReset=async(bal)=>{try{await postApi("/api/treasury/admin/reset-cycle",bal?{new_balance:parseInt(bal)}:{});toast("Cycle reset!","success");setShowReset(false);loadOv()}catch(e){toast("Reset failed","error");setShowReset(false)}};
  const doPayout=async(did,amt,reason)=>{try{await postApi("/api/treasury/admin/payout",{discord_id:parseInt(did),amount:parseInt(amt),reason:reason||"Admin payout"});toast(`Sent ${fmt(amt)} 🟤`,"success");loadOv()}catch(e){toast("Payout failed: "+e.message,"error")}};

  const tabs=[{key:"overview",icon:"🏦",label:"Overview"},{key:"controls",icon:"⚙️",label:"Controls"},{key:"payout",icon:"💰",label:"Payout"},{key:"log",icon:"📋",label:"Event Log"}];
  if(loading)return<><Title t="TREASURY" s="economy health · coin flow"/><Load/></>;

  return(<>
    <Title t="TREASURY" s="economy health · coin flow · cycle status"/>
    <div style={{display:"flex",gap:6,marginBottom:24}}>{tabs.map(tab=><button key={tab.key} className={`ap-ft ${sub===tab.key?"act":""}`} onClick={()=>{setSub(tab.key);if(tab.key==="log")loadLog(logFilter)}}>{tab.icon} {tab.label}</button>)}</div>
    {sub==="overview"&&t&&<>
      {t.balance===0&&<div className="ap-alert dep">⚠ TREASURY DEPLETED — reward payouts are paused.</div>}
      {t.balance>0&&t.health_pct<15&&<div className="ap-alert low">⚠ Treasury low ({t.health_pct}%) — consider a top-up or cycle reset.</div>}
      <div className="ap-hero"><div className="ap-hero-g">
        <div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:3,color:"var(--textdim)",textTransform:"uppercase",marginBottom:10}}>Current Treasury Balance</div>
          <div className={`ap-big ${t.balance===0?"dep":t.health_pct<20?"low":""}`}>{fmt(t.balance)}</div>
          <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--textdim)",marginTop:6}}>{bronzeToCoins(t.balance)}</div>
          <div className="ap-hbar"><div className={`ap-hfill ${t.health_pct<10?"red":t.health_pct<25?"amber":""}`} style={{width:`${t.health_pct}%`}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--mono)",fontSize:10,color:"var(--textdim)"}}><span>{t.health_pct}%</span><span>Cap: {fmt(t.cap)} 🟤</span></div>
        </div>
        <div style={{textAlign:"right",minWidth:180}}>
          <div className={`ap-mbadge ${t.model}`}>{t.model==="B"?"♻ CIRCULATING":"🔥 HARD CAP"}</div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:2,color:"var(--textdim)",textTransform:"uppercase",marginBottom:4}}>Cycle</div>
          <div style={{fontFamily:"var(--display)",fontSize:24,letterSpacing:2,color:"var(--text)",marginBottom:8}}>{t.cycle_days_remaining>0?`${t.cycle_days_remaining}d left`:"OVERDUE"}</div>
          <div className="ap-cyc" style={{marginLeft:"auto"}}><div className="ap-cyc-f" style={{width:`${t.cycle_pct}%`}}/></div>
        </div>
      </div></div>
      <div className="ap-sr"><SC label="Paid Out (24h)" value={s24?fmt(s24.paid_out):"—"} sub={s24?`${s24.payout_count} payouts`:""}/><SC label="Burned (24h)" value={s24?fmt(s24.burned):"—"} color="red"/><SC label="Recycled (24h)" value={s24?fmt(s24.recycled):"—"} color="green"/><SC label="Cycle Total" value={t?fmt(t.total_paid_out):"—"} color="blue"/></div>
      <TW title="RECENT EVENTS" right={<><B c="ghost" sm onClick={loadOv}>↻</B><B c="ghost" sm onClick={()=>{setSub("log");loadLog(null)}}>All →</B></>}>
        {rLog.length?<div>{rLog.slice(0,12).map((e,i)=><div key={i} className="ap-lr"><span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type}/><span className="ap-lr-d">{e.reason||"—"}</span><span className="ap-lr-p">{e.player||(e.discord_id?`#${e.discord_id}`:"—")}</span><span className={`ap-lr-v ${["payout","burn"].includes(e.event_type)?"neg":e.amount>0?"pos":"neu"}`}>{["payout","burn"].includes(e.event_type)?"−":e.amount>0?"+":""}{fmt(Math.abs(e.amount))} 🟤</span><span style={{color:"var(--textdim)",fontFamily:"var(--mono)",fontSize:11,minWidth:80,textAlign:"right"}}>→ {fmt(e.balance_after)}</span></div>)}</div>:<Empty text="no events"/>}
      </TW>
    </>}
    {sub==="controls"&&<div className="ap-2c">
      <div>
        <FB title="ADJUST BALANCE"><div className="ap-note">Positive = add to treasury, negative = remove.</div><AdjustForm onSubmit={doAdjust}/></FB>
        <FB title="TREASURY CAP"><CapForm t={t} onSubmit={(cap)=>doConfig({cap})} /></FB>
      </div>
      <div>
        <FB title="ECONOMY MODEL"><div className="ap-note"><strong style={{color:"var(--text)"}}>Model B — Circulating:</strong> Fees return to treasury.<br/><strong style={{color:"var(--text)"}}>Model A — Hard Cap:</strong> Fees destroyed.</div><Sel label="Active Model" value={t?.model||"B"} onChange={e=>doConfig({model:e.target.value})}><option value="B">Model B — Circulating</option><option value="A">Model A — Hard Cap</option></Sel></FB>
        <FB title="CYCLE LENGTH"><div className="ap-inline"><Inp label="Days per cycle" type="number" placeholder="30"/><B c="ghost" onClick={(e)=>{const v=e.target.previousSibling?.querySelector?.("input")?.value;if(v)doConfig({cycle_days:parseInt(v)})}}>Set</B></div></FB>
        <FB title="RESET CYCLE"><div className="ap-note danger">⚠ Resets all counters. Cannot be undone.</div><B c="red" onClick={()=>setShowReset(true)}>⚠ Reset Cycle</B></FB>
      </div>
    </div>}
    {sub==="payout"&&<TreasuryPayout t={t} doPayout={doPayout}/>}
    {sub==="log"&&<TW title="EVENTS" right={<><div style={{display:"flex",gap:6}}>{[null,"payout","burn","recycle","reset","adjust"].map(f=><button key={f||"all"} className={`ap-ft ${logFilter===f?"act":""}`} onClick={()=>{setLogFilter(f);loadLog(f)}}>{f||"All"}</button>)}</div><B c="ghost" sm onClick={()=>loadLog(logFilter)}>↻</B></>}>
      {log.length?<div>{log.map((e,i)=><div key={i} className="ap-lr"><span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.event_type}/><span className="ap-lr-d">{e.reason||"—"}</span><span className="ap-lr-p">{e.player||(e.discord_id?`#${e.discord_id}`:"—")}</span><span className={`ap-lr-v ${["payout","burn"].includes(e.event_type)?"neg":e.amount>0?"pos":"neu"}`}>{["payout","burn"].includes(e.event_type)?"−":e.amount>0?"+":""}{fmt(Math.abs(e.amount))} 🟤</span><span style={{color:"var(--textdim)",fontFamily:"var(--mono)",fontSize:11,minWidth:80,textAlign:"right"}}>→ {fmt(e.balance_after)}</span></div>)}</div>:<Empty text="no events"/>}
    </TW>}
    {showReset&&<div className="ap-mbd" onClick={e=>{if(e.target===e.currentTarget)setShowReset(false)}}><div className="ap-mod" style={{width:480}}>
      <button className="ap-mod-x" onClick={()=>setShowReset(false)}>✕</button><h3>RESET CYCLE?</h3>
      <ResetCycleForm onConfirm={doReset} onClose={()=>setShowReset(false)}/>
    </div></div>}
  </>);
};

const AdjustForm = ({onSubmit}) => {
  const [amt,setAmt]=useState("");const [r,setR]=useState("");
  return(<><Inp label="Amount (bronze)" type="number" placeholder="50000 or -10000" value={amt} onChange={e=>setAmt(e.target.value)}/><Inp label="Reason" placeholder="Season top-up" value={r} onChange={e=>setR(e.target.value)}/><B c="gold" onClick={()=>{if(!amt||amt==0)return;onSubmit(parseInt(amt),r);setAmt("");setR("")}}>Apply</B></>);
};
const CapForm = ({t,onSubmit}) => {
  const [cap,setCap]=useState("");
  return(<><div className="ap-note info">Current cap: {t?fmt(t.cap):"—"} 🟤</div><div className="ap-inline"><Inp label="New Cap (bronze)" type="number" placeholder="500000" value={cap} onChange={e=>setCap(e.target.value)}/><B c="ghost" onClick={()=>{if(!cap)return;onSubmit(parseInt(cap));setCap("")}}>Set</B></div></>);
};
const ResetCycleForm = ({onConfirm,onClose}) => {
  const [bal,setBal]=useState("");
  return(<><div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--textdim)",lineHeight:1.7,marginBottom:24}}>New cycle starts. All counters reset. Balance refills to cap or value below.<br/><br/><span style={{color:"var(--red)"}}>Cannot be undone.</span></div><Inp label="Starting balance (blank = full cap)" type="number" placeholder="Leave blank for cap" value={bal} onChange={e=>setBal(e.target.value)}/><div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:16}}><B c="ghost" onClick={onClose}>Cancel</B><B c="red" onClick={()=>onConfirm(bal||null)}>Confirm Reset</B></div></>);
};
const TreasuryPayout = ({t,doPayout}) => {
  const [did,setDid]=useState("");const [amt,setAmt]=useState("");const [r,setR]=useState("");
  return(<div className="ap-2c">
    <FB title="MANUAL PAYOUT">
      <div className="ap-note">Pays from treasury directly to a player's wallet.</div>
      <Inp label="Discord ID" placeholder="228533264174940160" value={did} onChange={e=>setDid(e.target.value)}/>
      <Inp label="Amount (bronze)" type="number" placeholder="5000" value={amt} onChange={e=>setAmt(e.target.value)}/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0 16px"}}>{[1000,5000,10000,50000,100000].map(n=><button key={n} className="ap-pre" onClick={()=>setAmt(String(n))}>{n>=10000?`${n/10000} Gold`:`${n/1000} Silver`}</button>)}</div>
      <Inp label="Reason" placeholder="Event prize..." value={r} onChange={e=>setR(e.target.value)}/>
      <B c="green" full onClick={()=>{if(!did||!amt)return;doPayout(did,amt,r);setDid("");setAmt("");setR("")}}>▶ Send from Treasury</B>
    </FB>
    <div>
      <FB title="REWARD REFERENCE"><table className="ap-t"><thead><tr><th>Source</th><th>Amount</th><th>Flow</th></tr></thead><tbody>
        {[["🐺 Werewolf Win","150 🟤","payout"],["🎯 Quiz Win","150 🟤","payout"],["🚀 Travel Fee","5,000 🟤","recycle"],["⚔️ RPS/C4 Rake","5% of pot","recycle"],["🎟️ Lottery","1,000 🟤","recycle"]].map(([s,a,f],i)=><tr key={i}><td style={{fontFamily:"var(--mono)",fontSize:12}}>{s}</td><td style={{fontFamily:"var(--mono)",fontSize:12,color:f==="payout"?"var(--accent)":"var(--orange)"}}>{a}</td><td><EvBadge type={f}/></td></tr>)}
      </tbody></table></FB>
      {t&&<FB title="SNAPSHOT"><div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--textdim)",lineHeight:2.2}}>Balance: <span style={{color:"var(--accent)"}}>{fmt(t.balance)} 🟤</span><br/>Health: <span style={{color:t.health_pct>25?"var(--green)":t.health_pct>10?"var(--orange)":"var(--red)"}}>{t.health_pct}%</span><br/>Model: <span style={{color:"var(--text)"}}>{t.model==="B"?"Circulating":"Hard Cap"}</span><br/>Cycle: <span style={{color:"var(--text)"}}>{t.cycle_days_remaining}d left</span></div></FB>}
    </div>
  </div>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. ECONOMY / WALLETS
   ═══════════════════════════════════════════════════════════════════════════ */
const EconomyPanel = ({toast}) => {
  const [tab,setTab]=useState("give");
  const [name,setName]=useState("");const [amt,setAmt]=useState("");const [reason,setReason]=useState("");
  const [txns,setTxns]=useState([]);const [txnId,setTxnId]=useState("");const [txnLoading,setTxnLoading]=useState(false);
  const [allTxns,setAllTxns]=useState([]);const [allLoading,setAllLoading]=useState(false);

  const give=async()=>{if(!name||!amt){toast("Name and amount required","error");return}try{const r=await postApi("/api/admin/economy/give-by-name",{name,amount:parseInt(amt),reason:reason||"Admin grant"});toast(`Sent ${fmt(amt)} 🟤 to ${r.player}`,"success");setAmt("");setReason("")}catch(e){toast(e.message,"error")}};
  const take=async()=>{if(!name||!amt){toast("Name and amount required","error");return}try{const r=await postApi("/api/admin/economy/take-by-name",{name,amount:parseInt(amt),reason:reason||"Admin deduction"});toast(`Took ${fmt(amt)} 🟤 from ${r.player}`,"success");setAmt("");setReason("")}catch(e){toast(e.message,"error")}};
  const loadPlayerTxns=async()=>{if(!txnId){toast("Enter Discord ID","error");return}setTxnLoading(true);try{const r=await fetchApi(`/api/admin/economy/player-transactions?discord_id=${txnId}&limit=50`);setTxns(r.transactions||[])}catch(e){toast(e.message,"error")}setTxnLoading(false)};
  const loadAllTxns=useCallback(async()=>{setAllLoading(true);try{const r=await fetchApi("/api/admin/economy/transactions?limit=100");setAllTxns(r.transactions||[])}catch{}setAllLoading(false)},[]);
  useEffect(()=>{if(tab==="log")loadAllTxns()},[tab,loadAllTxns]);

  return(<>
    <Title t="WALLETS" s="give · take · transaction history"/>
    <div style={{display:"flex",gap:6,marginBottom:24}}>
      {[{k:"give",l:"💸 Give/Take"},{k:"lookup",l:"🔍 Player Lookup"},{k:"log",l:"📋 All Transactions"}].map(({k,l})=><button key={k} className={`ap-ft ${tab===k?"act":""}`} onClick={()=>setTab(k)}>{l}</button>)}
    </div>
    {tab==="give"&&<div className="ap-2c">
      <FB title="GIVE / TAKE COINS">
        <div className="ap-note">Look up by Discord display name or in-game name. Give sends from treasury; Take deducts from wallet.</div>
        <Inp label="Player Name (display or in-game)" placeholder="Nin" value={name} onChange={e=>setName(e.target.value)}/>
        <Inp label="Amount (bronze)" type="number" placeholder="5000" value={amt} onChange={e=>setAmt(e.target.value)}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0 16px"}}>{[500,1000,5000,10000,50000].map(n=><button key={n} className="ap-pre" onClick={()=>setAmt(String(n))}>{fmt(n)}</button>)}</div>
        <Inp label="Reason (optional)" placeholder="Event prize, compensation..." value={reason} onChange={e=>setReason(e.target.value)}/>
        <div style={{display:"flex",gap:12}}><B c="green" onClick={give}>💸 Give Coins</B><B c="red" onClick={take}>➖ Take Coins</B></div>
      </FB>
      <FB title="ECONOMY REFERENCE">
        <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--textdim)",lineHeight:2.2}}>
          <strong style={{color:"var(--text)"}}>Currency:</strong><br/>1 🟡 Gold = 10,000 🟤 Bronze<br/>1 ⚪ Silver = 1,000 🟤 Bronze<br/><br/>
          <strong style={{color:"var(--text)"}}>Income sources:</strong><br/>Werewolf/Quiz wins (150🟤)<br/>In-game cash deposits<br/>Shop sales<br/><br/>
          <strong style={{color:"var(--text)"}}>Coin sinks:</strong><br/>Shop purchases, Travel (5⚪)<br/>Lottery (1⚪), RPS/C4 bets
        </div>
      </FB>
    </div>}
    {tab==="lookup"&&<FB title="PLAYER TRANSACTION HISTORY">
      <div className="ap-note info">Enter a player's Discord ID to view their full transaction history.</div>
      <div className="ap-inline" style={{marginBottom:20}}><Inp label="Discord ID" placeholder="228533264174940160" value={txnId} onChange={e=>setTxnId(e.target.value)}/><B c="blue" onClick={loadPlayerTxns}>Load</B></div>
      {txnLoading?<Load/>:txns.length>0?<div>{txns.map((e,i)=><div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.type||e.event_type||"adjust"}/>
        <span className="ap-lr-d">{e.description||"—"}</span>
        <span className={`ap-lr-v ${e.amount>0?"pos":"neg"}`}>{e.amount>0?"+":""}{fmt(e.amount)} 🟤</span>
        <span style={{color:"var(--textdim)",fontFamily:"var(--mono)",fontSize:11,minWidth:80,textAlign:"right"}}>→ {fmt(e.balance_after)}</span>
      </div>)}</div>:<Empty text="enter a discord id and click load"/>}
    </FB>}
    {tab==="log"&&<TW title="ALL TRANSACTIONS" right={<B c="ghost" sm onClick={loadAllTxns}>↻</B>}>
      {allLoading?<Load/>:allTxns.length?<div>{allTxns.map((e,i)=><div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.type||e.event_type||"adjust"}/>
        <span className="ap-lr-d">{e.description||"—"}</span>
        <span className="ap-lr-p">{e.display_name||`#${e.discord_id}`||"—"}</span>
        <span className={`ap-lr-v ${e.amount>0?"pos":"neg"}`}>{e.amount>0?"+":""}{fmt(e.amount)} 🟤</span>
        <span style={{color:"var(--textdim)",fontFamily:"var(--mono)",fontSize:11,minWidth:80,textAlign:"right"}}>→ {fmt(e.balance_after)}</span>
      </div>)}</div>:<Empty text="no transactions found"/>}
    </TW>}
  </>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   6. DAWN OF THE DEAD
   ═══════════════════════════════════════════════════════════════════════════ */
const DotdPanel = ({toast}) => {
  const DEFAULTS={enabled:1,interval_hours:13,waves:3,zombies_per_wave:40,wave_interval_mins:10,min_spawn_distance:80,max_spawn_distance:150};
  const [c,setC]=useState(DEFAULTS);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
  const load=useCallback(async()=>{try{const d=await fetchApi("/api/admin/dotd/config");setC({...DEFAULTS,...d})}catch{setC(DEFAULTS)}setLoading(false)},[]);
  useEffect(()=>{load()},[load]);

  const save=async(updates)=>{setSaving(true);try{await postApi("/api/admin/dotd/update",updates);toast("Config saved","success");load()}catch(e){toast("Failed: "+e.message,"error")}setSaving(false)};
  const trigger=async()=>{try{await postApi("/api/admin/dotd/trigger",{});toast("💀 DotD triggered!","success");load()}catch(e){toast(e.message,"error")}};
  const cancel=async()=>{try{await postApi("/api/admin/dotd/cancel",{});toast("🛑 Event cancelled","success")}catch(e){toast(e.message,"error")}};

  if(loading)return<><Title t="DAWN OF THE DEAD" s="horde event configuration"/><Load/></>;
  return(<>
    <Title t="DAWN OF THE DEAD" s="horde event · config · triggers · scheduling"/>
    <div className="ap-sr" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
      <div className="ap-sc" style={{display:"flex",alignItems:"center",gap:16}}>
        <Toggle on={!!c.enabled} onClick={()=>save({enabled:c.enabled?0:1})}/>
        <div><div className="ap-sc-l">Status</div><div style={{fontFamily:"var(--display)",fontSize:22,letterSpacing:2,color:c.enabled?"var(--green)":"var(--red)"}}>{c.enabled?"ENABLED":"DISABLED"}</div></div>
      </div>
      <SC label="Last Event" value={c.last_event_at?relTime(c.last_event_at):"never"} color="blue" sub={c.last_event_at?fmtFull(c.last_event_at):""}/>
      <div className="ap-sc" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
        <B c="red" onClick={trigger}>💀 TRIGGER NOW</B>
        <B c="ghost" onClick={cancel}>🛑 Cancel</B>
      </div>
    </div>
    <FB title="EVENT CONFIGURATION">
      <div className="ap-note">Defaults: 13h interval · 3 waves · 40 zombies · 10min gap · 80–150 tile spawn range.</div>
      {[
        ["Interval (hours)","interval_hours",0.5,48,0.5,"h"],
        ["Waves per Event","waves",1,10,1,""],
        ["Zombies / Wave","zombies_per_wave",10,200,5,""],
        ["Wave Gap (min)","wave_interval_mins",1,60,1,"m"],
        ["Min Spawn Dist","min_spawn_distance",20,300,5," tiles"],
        ["Max Spawn Dist","max_spawn_distance",50,500,5," tiles"]
      ].map(([label,key,min,max,step,suffix])=>
        <div key={key} className="ap-sl">
          <label>{label}</label>
          <input type="range" min={min} max={max} step={step} value={c[key]} onChange={e=>setC({...c,[key]:parseFloat(e.target.value)})}/>
          <span className="ap-sl-v">{c[key]}{suffix}</span>
        </div>
      )}
      <div style={{display:"flex",gap:12,marginTop:20}}>
        <B c="gold" disabled={saving} onClick={()=>save({interval_hours:c.interval_hours,waves:c.waves,zombies_per_wave:c.zombies_per_wave,wave_interval_mins:c.wave_interval_mins,min_spawn_distance:c.min_spawn_distance,max_spawn_distance:c.max_spawn_distance})}>{saving?"Saving...":"Save Config"}</B>
        <B c="ghost" onClick={()=>{setC(DEFAULTS);toast("Reset to defaults (not saved)","info")}}>Reset Defaults</B>
      </div>
    </FB>
  </>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   7. TREASURE HUNT
   ═══════════════════════════════════════════════════════════════════════════ */
const HuntPanel = ({toast}) => {
  const [c,setC]=useState({enabled:1,interval_hours:6,duration_mins:30});
  const [history,setHistory]=useState([]);const [loading,setLoading]=useState(true);
  const [tType,setTType]=useState("");const [tRegion,setTRegion]=useState("");const [tDur,setTDur]=useState("30");

  const load=useCallback(async()=>{
    try{const cfg=await fetchApi("/api/admin/hunt/config");setC(cfg)}catch{}
    try{const h=await fetchApi("/api/admin/hunt/history?limit=50");setHistory(h.history||[])}catch{}
    setLoading(false);
  },[]);
  useEffect(()=>{load()},[load]);

  const updateConfig=async(updates)=>{try{await postApi("/api/admin/hunt/update",updates);toast("Config updated","success");load()}catch(e){toast(e.message,"error")}};
  const trigger=async()=>{try{const r=await postApi("/api/admin/hunt/trigger",{hunt_type:tType||null,region:tRegion||null,duration:parseInt(tDur)||30});toast(`🗺️ Hunt triggered! (${r.hunt_type} @ ${r.region})`,"success");setTimeout(load,1000)}catch(e){toast(e.message,"error")}};
  const cancel=async()=>{try{await postApi("/api/admin/hunt/cancel",{});toast("🛑 Hunt cancelled","success")}catch(e){toast(e.message,"error")}};

  if(loading)return<><Title t="TREASURE HUNT" s="world events"/><Load/></>;
  return(<>
    <Title t="TREASURE HUNT" s="triggers · scheduling · history"/>
    <div className="ap-sr" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
      <div className="ap-sc" style={{display:"flex",alignItems:"center",gap:16}}>
        <Toggle on={!!c.enabled} onClick={()=>updateConfig({enabled:c.enabled?0:1})}/>
        <div><div className="ap-sc-l">Auto Scheduler</div><div style={{fontFamily:"var(--display)",fontSize:22,letterSpacing:2,color:c.enabled?"var(--green)":"var(--red)"}}>{c.enabled?"ENABLED":"DISABLED"}</div></div>
      </div>
      <SC label="Interval" value={`${c.interval_hours}h`} color="blue" sub={`${c.duration_mins}min default duration`}/>
      <SC label="Last Hunt" value={c.last_hunt_at?relTime(c.last_hunt_at):"never"} color="orange" sub={c.last_hunt_at?fmtFull(c.last_hunt_at):""}/>
    </div>
    <div className="ap-2c">
      <FB title="TRIGGER HUNT">
        <div className="ap-note">Leave type/region blank for random. The bot will pick it up and execute.</div>
        <Sel label="Hunt Type" value={tType} onChange={e=>setTType(e.target.value)}>
          <option value="">🎲 Random</option>
          {HUNT_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </Sel>
        <Sel label="Region" value={tRegion} onChange={e=>setTRegion(e.target.value)}>
          <option value="">🎲 Random</option>
          {HUNT_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
        </Sel>
        <Inp label="Duration (min)" type="number" value={tDur} onChange={e=>setTDur(e.target.value)}/>
        <div style={{display:"flex",gap:12,marginTop:8}}>
          <B c="gold" onClick={trigger}>🗺️ TRIGGER HUNT</B>
          <B c="ghost" onClick={cancel}>🛑 Cancel Active</B>
        </div>
      </FB>
      <FB title="SCHEDULER CONFIG">
        <div className="ap-note info">Changes take effect on next auto-trigger.</div>
        <SchedulerConfigForm c={c} onSave={updateConfig}/>
      </FB>
    </div>
    <TW title="HUNT HISTORY" right={<B c="ghost" sm onClick={load}>↻</B>}>
      {history.length?<table className="ap-t"><thead><tr><th>Type</th><th>Region</th><th>Outcome</th><th>Winner</th><th>Zombies</th><th>Triggered By</th><th>Started</th></tr></thead>
      <tbody>{history.map((h,i)=><tr key={i}>
        <td><span className="ap-pill ap-tier-rare">{(h.hunt_type||"").charAt(0).toUpperCase()+(h.hunt_type||"").slice(1)}</span></td>
        <td style={{fontFamily:"var(--mono)"}}>{h.region||"—"}</td>
        <td><span className={`ap-pill ${h.outcome==="claimed"?"ap-tier-uncommon":"ap-tier-common"}`}>{h.outcome||"running"}</span></td>
        <td style={{fontFamily:"var(--mono)",color:"var(--accent)"}}>{h.winner||"—"}</td>
        <td style={{fontFamily:"var(--mono)"}}>{h.zombie_count||"—"}</td>
        <td style={{fontFamily:"var(--mono)",color:"var(--textdim)"}}>{h.triggered_by||"auto"}</td>
        <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--textdim)"}}>{fmtFull(h.started_at)}</td>
      </tr>)}</tbody></table>:<Empty text="no hunt history yet"/>}
    </TW>
  </>);
};

const SchedulerConfigForm = ({c,onSave}) => {
  const [interval,setInterval]=useState(String(c.interval_hours||6));
  const [duration,setDuration]=useState(String(c.duration_mins||30));
  return(<><Inp label="Interval (hours)" type="number" step="0.5" value={interval} onChange={e=>setInterval(e.target.value)}/><Inp label="Default Duration (min)" type="number" value={duration} onChange={e=>setDuration(e.target.value)}/><B c="gold" onClick={()=>onSave({interval_hours:parseFloat(interval)||6,duration_mins:parseInt(duration)||30})}>Save</B></>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   8. PLAYERS
   ═══════════════════════════════════════════════════════════════════════════ */
const PlayersPanel = ({toast}) => {
  const [players,setPlayers]=useState([]);const [search,setSearch]=useState("");const [loading,setLoading]=useState(true);const [selected,setSelected]=useState(null);
  useEffect(()=>{(async()=>{try{setPlayers((await fetchApi("/api/community")).members||[])}catch{}setLoading(false)})()},[]);
  const filtered=useMemo(()=>{if(!search)return players;const q=search.toLowerCase();return players.filter(p=>p.display_name?.toLowerCase().includes(q)||String(p.discord_id).includes(q)||p.ingame_name?.toLowerCase().includes(q))},[players,search]);
  const loadDetail=async(id)=>{try{setSelected(await fetchApi(`/api/stats/player/${id}`))}catch{toast("Failed to load player","error")}};

  if(selected)return<PlayerDetail p={selected} onBack={()=>setSelected(null)} toast={toast}/>;
  return(<>
    <Title t="PLAYERS" s="community roster · stats · profiles"/>
    <div className="ap-sr" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
      <SC label="Total Players" value={players.length}/>
      <SC label="Active (30d)" value={players.filter(p=>p.last_seen&&(Date.now()/1000-p.last_seen)<2592000).length} color="green"/>
      <SC label="Whitelisted" value={players.filter(p=>p.ingame_name).length} color="blue"/>
    </div>
    <TW title="ROSTER" right={<input className="ap-search" placeholder="search name, id, ingame..." value={search} onChange={e=>setSearch(e.target.value)}/>}>
      {loading?<Load/>:<table className="ap-t"><thead><tr><th>Player</th><th>In-Game</th><th>Messages</th><th>Games</th><th>Win Rate</th><th>Balance</th><th>Last Seen</th><th></th></tr></thead>
      <tbody>{filtered.length===0?<tr><td colSpan={8}><Empty text="no players"/></td></tr>:filtered.slice(0,100).map(p=>{
        const wr=p.games_played>0?Math.round(p.games_won/p.games_played*100):0;
        return<tr key={p.discord_id}>
          <td><div style={{fontWeight:500}}>{p.display_name}</div><div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--textdim)"}}>{p.username?`@${p.username}`:""}</div></td>
          <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--textdim)"}}>{p.ingame_name||"—"}</td>
          <td style={{fontFamily:"var(--mono)"}}>{fmt(p.message_count)}</td>
          <td style={{fontFamily:"var(--mono)"}}>{p.games_played||0}</td>
          <td style={{fontFamily:"var(--mono)",color:wr>50?"var(--green)":"var(--textdim)"}}>{wr}%</td>
          <td style={{fontFamily:"var(--mono)",fontSize:11}}>{bronzeToCoins(p.balance)}</td>
          <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--textdim)"}}>{relTime(p.last_seen)}</td>
          <td><B c="blue" sm onClick={()=>loadDetail(p.discord_id)}>View</B></td>
        </tr>;
      })}</tbody></table>}
    </TW>
  </>);
};

const PlayerDetail = ({p,onBack,toast}) => {
  const ww=p.werewolf||{},rps=p.rps||{},c4=p.connect4||{};
  const [txns,setTxns]=useState([]);const [txnLoading,setTxnLoading]=useState(false);const [showTxns,setShowTxns]=useState(false);
  const [giveAmt,setGiveAmt]=useState("");const [giveReason,setGiveReason]=useState("");
  const [takeAmt,setTakeAmt]=useState("");const [takeReason,setTakeReason]=useState("");

  const loadTxns=async()=>{setTxnLoading(true);try{const r=await fetchApi(`/api/admin/economy/player-transactions?discord_id=${p.discord_id}&limit=30`);setTxns(r.transactions||[])}catch(e){toast(e.message,"error")}setTxnLoading(false);setShowTxns(true)};
  const giveCoins=async()=>{if(!giveAmt){toast("Enter amount","error");return}try{const r=await postApi("/api/admin/economy/give-by-name",{name:p.display_name,amount:parseInt(giveAmt),reason:giveReason||"Admin grant"});toast(`Sent ${fmt(giveAmt)} 🟤 to ${r.player}`,"success");setGiveAmt("");setGiveReason("")}catch(e){toast(e.message,"error")}};
  const takeCoins=async()=>{if(!takeAmt){toast("Enter amount","error");return}try{const r=await postApi("/api/admin/economy/take-by-name",{name:p.display_name,amount:parseInt(takeAmt),reason:takeReason||"Admin deduction"});toast(`Took ${fmt(takeAmt)} 🟤 from ${r.player}`,"success");setTakeAmt("");setTakeReason("")}catch(e){toast(e.message,"error")}};

  return(<>
    <div style={{marginBottom:20}}><B c="ghost" sm onClick={onBack}>← Back to Players</B></div>
    <div style={{fontFamily:"var(--display)",fontSize:32,letterSpacing:3,color:"var(--accent)",marginBottom:4}}>{p.display_name}</div>
    <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--textdim)",marginBottom:28}}>
      ID: {p.discord_id} · {p.username?`@${p.username} · `:""}Joined: {fmtDate(p.first_seen)} · Last seen: {relTime(p.last_seen)}
    </div>
    <div className="ap-sr">
      <SC label="Balance" value={bronzeToCoins(p.balance)}/>
      <SC label="Messages" value={fmt(p.message_count)} color="blue"/>
      <SC label="WW Wins" value={ww.games_won??0} color="green" sub={`${ww.games_played??0} played`}/>
      <SC label="Win Rate" value={`${ww.win_rate??0}%`} color="orange"/>
    </div>
    <div className="ap-3c">
      <FB title="WEREWOLF">
        <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--textdim)",lineHeight:2.2}}>
          Played: {ww.games_played??0}<br/>
          Won: <span style={{color:"var(--green)"}}>{ww.games_won??0}</span><br/>
          Survived: {ww.times_survived??0}<br/>
          Lynched: <span style={{color:"var(--red)"}}>{ww.times_lynched??0}</span><br/>
          Times Wolf: <span style={{color:"var(--orange)"}}>{ww.times_wolf??0}</span><br/>
          Streak: <span style={{color:"var(--accent)"}}>{ww.streak??0}</span>
        </div>
      </FB>
      <FB title="ROCK PAPER SCISSORS">
        <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--textdim)",lineHeight:2.2}}>
          W/L/D: <span style={{color:"var(--green)"}}>{rps.wins??0}</span> / <span style={{color:"var(--red)"}}>{rps.losses??0}</span> / {rps.draws??0}<br/>
          Win Rate: {rps.win_rate??0}%<br/>
          Earned: <span style={{color:"var(--green)"}}>+{fmt(rps.coins_won??0)}</span><br/>
          Lost: <span style={{color:"var(--red)"}}>−{fmt(rps.coins_lost??0)}</span><br/>
          vs Zombita: {rps.vs_zombita_wins??0}W / {rps.vs_zombita_losses??0}L
        </div>
      </FB>
      <FB title="CONNECT 4">
        <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--textdim)",lineHeight:2.2}}>
          W/L/D: <span style={{color:"var(--green)"}}>{c4.wins??0}</span> / <span style={{color:"var(--red)"}}>{c4.losses??0}</span> / {c4.draws??0}<br/>
          Win Rate: {c4.win_rate??0}%<br/>
          Earned: <span style={{color:"var(--green)"}}>+{fmt(c4.coins_won??0)}</span><br/>
          Lost: <span style={{color:"var(--red)"}}>−{fmt(c4.coins_lost??0)}</span><br/>
          vs Zombita: {c4.vs_zombita_wins??0}W / {c4.vs_zombita_losses??0}L
        </div>
      </FB>
    </div>
    <div className="ap-2c">
      <FB title="GIVE COINS">
        <Inp label="Amount (bronze)" type="number" placeholder="5000" value={giveAmt} onChange={e=>setGiveAmt(e.target.value)}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0 12px"}}>{[500,1000,5000,10000].map(n=><button key={n} className="ap-pre" onClick={()=>setGiveAmt(String(n))}>{fmt(n)}</button>)}</div>
        <Inp label="Reason" placeholder="Event prize..." value={giveReason} onChange={e=>setGiveReason(e.target.value)}/>
        <B c="green" onClick={giveCoins}>💸 Give Coins</B>
      </FB>
      <FB title="TAKE COINS">
        <Inp label="Amount (bronze)" type="number" placeholder="5000" value={takeAmt} onChange={e=>setTakeAmt(e.target.value)}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"4px 0 12px"}}>{[500,1000,5000,10000].map(n=><button key={n} className="ap-pre" onClick={()=>setTakeAmt(String(n))}>{fmt(n)}</button>)}</div>
        <Inp label="Reason" placeholder="Penalty, correction..." value={takeReason} onChange={e=>setTakeReason(e.target.value)}/>
        <B c="red" onClick={takeCoins}>➖ Take Coins</B>
      </FB>
    </div>
    <div style={{marginTop:8}}>
      {!showTxns?<B c="ghost" onClick={loadTxns}>📋 Load Transaction History</B>:
      txnLoading?<Load/>:
      <TW title="TRANSACTION HISTORY" right={<B c="ghost" sm onClick={loadTxns}>↻</B>}>
        {txns.length?<div>{txns.map((e,i)=><div key={i} className="ap-lr">
          <span className="ap-lr-t">{relTime(e.timestamp)}</span><EvBadge type={e.type||"adjust"}/>
          <span className="ap-lr-d">{e.description||"—"}</span>
          <span className={`ap-lr-v ${e.amount>0?"pos":"neg"}`}>{e.amount>0?"+":""}{fmt(e.amount)} 🟤</span>
          <span style={{color:"var(--textdim)",fontFamily:"var(--mono)",fontSize:11,minWidth:80,textAlign:"right"}}>→ {fmt(e.balance_after)}</span>
        </div>)}</div>:<Empty text="no transactions"/>}
      </TW>}
    </div>
  </>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   9. GAMES
   ═══════════════════════════════════════════════════════════════════════════ */
const GamesPanel = ({toast}) => {
  const [rpsB,setRpsB]=useState([]);const [c4B,setC4B]=useState([]);const [tab,setTab]=useState("rps");const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{try{const[r,c]=await Promise.all([fetchApi("/api/stats/rps").catch(()=>({leaderboard:[]})),fetchApi("/api/stats/connect4").catch(()=>({leaderboard:[]}))]);setRpsB(r.leaderboard||[]);setC4B(c.leaderboard||[])}catch{}setLoading(false)})()},[]);
  const board=tab==="rps"?rpsB:c4B;
  const medalColor=(i)=>i===0?"#c8a84b":i===1?"#9ca3af":i===2?"#c47a4a":"var(--textdim)";
  return(<>
    <Title t="GAMES" s="rps · connect 4 · leaderboards"/>
    <div style={{display:"flex",gap:6,marginBottom:24}}>
      <button className={`ap-ft ${tab==="rps"?"act":""}`} onClick={()=>setTab("rps")}>🪨 Rock Paper Scissors</button>
      <button className={`ap-ft ${tab==="c4"?"act":""}`} onClick={()=>setTab("c4")}>🔴 Connect 4</button>
    </div>
    {loading?<Load/>:<TW title={tab==="rps"?"RPS LEADERBOARD":"CONNECT 4 LEADERBOARD"}>
      <table className="ap-t"><thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Losses</th><th>Draws</th><th>Win Rate</th><th>Earned</th><th>Lost</th><th>vs Zombita</th></tr></thead>
      <tbody>{board.length===0?<tr><td colSpan={9}><Empty text="no game data yet"/></td></tr>:board.map((p,i)=><tr key={i}>
        <td style={{fontFamily:"var(--display)",fontSize:20,color:medalColor(i)}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
        <td style={{fontWeight:500}}>{p.display_name||p.name}</td>
        <td style={{fontFamily:"var(--mono)",color:"var(--green)"}}>{p.wins}</td>
        <td style={{fontFamily:"var(--mono)",color:"var(--red)"}}>{p.losses}</td>
        <td style={{fontFamily:"var(--mono)",color:"var(--textdim)"}}>{p.draws}</td>
        <td style={{fontFamily:"var(--mono)",color:p.win_rate>50?"var(--green)":"var(--textdim)"}}>{p.win_rate??Math.round((p.wins/(p.wins+p.losses+p.draws||1))*100)}%</td>
        <td style={{fontFamily:"var(--mono)",color:"var(--green)"}}>+{fmt(p.coins_won||0)} 🟤</td>
        <td style={{fontFamily:"var(--mono)",color:"var(--red)"}}>−{fmt(p.coins_lost||0)} 🟤</td>
        <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--textdim)"}}>{p.vs_zombita_wins??0}W / {p.vs_zombita_losses??0}L</td>
      </tr>)}</tbody></table>
    </TW>}
  </>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   10. MODS & BROADCAST
   ═══════════════════════════════════════════════════════════════════════════ */
const ModsPanel = ({toast}) => {
  const [sub,setSub]=useState("broadcast");
  const [bcastType,setBcastType]=useState("info");const [bcastMsg,setBcastMsg]=useState("");
  const [mods,setMods]=useState([]);const [modsLoading,setModsLoading]=useState(true);const [newModId,setNewModId]=useState("");

  const loadMods=useCallback(async()=>{try{const d=await fetchApi("/api/admin/mods/list");setMods(d.mods||[])}catch{setMods([])}setModsLoading(false)},[]);
  useEffect(()=>{loadMods()},[loadMods]);

  const broadcast=async()=>{if(!bcastMsg.trim()){toast("Message required","error");return}try{await postApi("/api/admin/server/broadcast",{type:bcastType,message:bcastMsg});toast("Broadcast sent!","success");setBcastMsg("")}catch(e){toast(`Broadcast failed: ${e.message}`,"error")}};
  const sendIngame=async()=>{if(!bcastMsg.trim()){toast("Message required","error");return}try{await postApi("/api/admin/server/rcon",{command:`servermsg "${bcastMsg}"`});toast("Sent to server!","success")}catch(e){toast(e.message,"error")}};
  const toggleMod=async(id,en)=>{try{await postApi("/api/admin/mods/toggle",{workshop_id:id,enabled:en});toast(en?"Mod enabled":"Mod disabled","success");loadMods()}catch(e){toast(`Failed: ${e.message}`,"error")}};
  const addMod=async()=>{if(!newModId.trim()){toast("Workshop ID required","error");return}try{await postApi("/api/admin/mods/add",{workshop_id:newModId.trim()});toast("Mod added!","success");setNewModId("");loadMods()}catch(e){toast(`Failed: ${e.message}`,"error")}};
  const removeMod=async(id)=>{if(!confirm(`Remove mod ${id}?`))return;try{await postApi("/api/admin/mods/remove",{workshop_id:id});toast("Mod removed","success");loadMods()}catch(e){toast(`Failed: ${e.message}`,"error")}};

  const tabs=[{key:"broadcast",icon:"📢",label:"Broadcast"},{key:"modlist",icon:"🔧",label:"Mod List"}];
  const typeColors={info:"var(--blue)",warning:"var(--orange)",alert:"var(--red)",event:"var(--accent)"};

  return(<>
    <Title t="MODS & BROADCAST" s="announcements · mod management"/>
    <div style={{display:"flex",gap:6,marginBottom:24}}>{tabs.map(t=><button key={t.key} className={`ap-ft ${sub===t.key?"act":""}`} onClick={()=>setSub(t.key)}>{t.icon} {t.label}</button>)}</div>
    {sub==="broadcast"&&<div className="ap-2c">
      <FB title="BROADCAST TO DISCORD">
        <div className="ap-note">Sends an announcement to the Discord server.</div>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {["info","warning","alert","event"].map(type=>(
            <button key={type} style={{padding:"10px 20px",border:`2px solid ${bcastType===type?typeColors[type]:"var(--border)"}`,background:bcastType===type?`${typeColors[type]}11`:"transparent",color:bcastType===type?typeColors[type]:"var(--textdim)",fontFamily:"var(--mono)",fontSize:11,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",borderRadius:2,transition:"all .15s"}} onClick={()=>setBcastType(type)}>
              {{info:"ℹ️",warning:"⚠️",alert:"🚨",event:"🎉"}[type]} {type}
            </button>
          ))}
        </div>
        <TA label="Message" placeholder="Type your announcement here..." value={bcastMsg} onChange={e=>setBcastMsg(e.target.value)}/>
        <div style={{display:"flex",gap:10,marginTop:8}}><B c="gold" onClick={broadcast}>📢 Discord Broadcast</B><B c="blue" onClick={sendIngame}>💬 In-Game Msg</B></div>
      </FB>
      <FB title="QUICK MESSAGES">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {["Server restarting in 5 minutes","Server restarting in 1 minute","Maintenance starting soon","Event starting! Check Discord!","Server updated — please reconnect"].map((msg,i)=>(
            <button key={i} className="ap-pre" style={{textAlign:"left",padding:10}} onClick={()=>setBcastMsg(msg)}>{msg}</button>
          ))}
        </div>
      </FB>
    </div>}
    {sub==="modlist"&&<>
      <div className="ap-inline" style={{marginBottom:20}}>
        <Inp label="Add Mod (Workshop ID)" placeholder="2895447475" value={newModId} onChange={e=>setNewModId(e.target.value)}/>
        <B c="green" onClick={addMod}>➕ Add Mod</B>
      </div>
      <TW title="SERVER MODS" right={<B c="ghost" sm onClick={loadMods}>↻</B>}>
        {modsLoading?<Load/>:mods.length?<table className="ap-t"><thead><tr><th>⚡</th><th>Name</th><th>Workshop ID</th><th>Actions</th></tr></thead>
        <tbody>{mods.map((m,i)=><tr key={i}>
          <td><Toggle on={m.enabled!==false} onClick={()=>toggleMod(m.workshop_id,!m.enabled)}/></td>
          <td style={{fontWeight:500}}>{m.name||"Unknown Mod"}</td>
          <td style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--textdim)"}}>{m.workshop_id}</td>
          <td><B c="red" sm onClick={()=>removeMod(m.workshop_id)}>Remove</B></td>
        </tr>)}</tbody></table>:<Empty text="No mods loaded — endpoint may not exist yet"/>}
      </TW>
    </>}
  </>);
};

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL MAP
   ═══════════════════════════════════════════════════════════════════════════ */
const PANELS = {
  overview:  OverviewPanel,
  server:    ServerPanel,
  shop:      ShopPanel,
  treasury:  TreasuryPanel,
  economy:   EconomyPanel,
  dotd:      DotdPanel,
  hunt:      HuntPanel,
  players:   PlayersPanel,
  games:     GamesPanel,
  mods:      ModsPanel,
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SHELL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminPanel() {
  const [page, setPage] = useState("overview");
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((msg, type = "info") => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const ActivePanel = PANELS[page] || OverviewPanel;

  return (
    <div className="ap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ap-hd">
        <div className="ap-logo">SOUP ADMIN</div>
        <span className="ap-hd-badge">v2.0</span>
        <div className="ap-hd-right">
          <span>STATE OF UNDEAD PURGE</span>
          <span className="on">● CONNECTED</span>
        </div>
      </div>
      <div className="ap-shell">
        <nav className="ap-nav">
          <a href="/" className="ap-nav-back">← Back to Site</a>
          <div className="ap-nav-div" />
          {NAV_SECTIONS.map((sec, si) => (
            <div key={si}>
              {si > 0 && <div className="ap-nav-div" />}
              <div className="ap-nav-sec">{sec.label}</div>
              {sec.items.map(item => (
                <div key={item.key} className={`ap-nav-a ${page === item.key ? "act" : ""}`} onClick={() => setPage(item.key)}>
                  <span className="ap-nav-ico">{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <main className="ap-main">
          <ActivePanel toast={toast} />
        </main>
      </div>
      <Toasts items={toasts} />
    </div>
  );
}
