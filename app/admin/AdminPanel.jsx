"use client";
// @ts-nocheck
import { useState, useCallback, useRef, useEffect } from "react";
import { Toasts, ADMINS } from "./tabs/shared";
import OverviewTab    from "./tabs/OverviewTab";
import ServerTab      from "./tabs/ServerTab";
import ShopTab        from "./tabs/ShopTab";
import TreasuryTab    from "./tabs/TreasuryTab";
import EconomyTab     from "./tabs/EconomyTab";
import DotdTab        from "./tabs/DotdTab";
import HuntTab        from "./tabs/HuntTab";
import PlayersTab     from "./tabs/PlayersTab";
import GamesTab       from "./tabs/GamesTab";
import ReputationTab  from "./tabs/ReputationTab";
import SystemTab      from "./tabs/SystemTab";
import ServerConfigTab from "./tabs/ServerConfigTab";
import PlannerTab from "./tabs/PlannerTab";

const NAV_SECTIONS = [
  { label: "COMMAND", items: [
    { key: "overview",       icon: "📡", label: "Overview" },
    { key: "server",         icon: "🖥️", label: "Server" },
    { key: "system",         icon: "⚙️",  label: "System Panel" },
  ]},
  { label: "ECONOMY", items: [
    { key: "shop",           icon: "📦", label: "Shop" },
    { key: "treasury",       icon: "🏦", label: "Treasury" },
    { key: "economy",        icon: "💰", label: "Wallets" },
  ]},
  { label: "WORLD", items: [
    { key: "dotd",           icon: "💀", label: "Dawn of Dead" },
    { key: "hunt",           icon: "🗺️", label: "Treasure Hunt" },
  ]},
  { label: "COMMUNITY", items: [
    { key: "players",        icon: "👥", label: "Players" },
    { key: "games",          icon: "🎮", label: "Games" },
    { key: "reputation",     icon: "🎭", label: "Reputation" },
  ]},
  { label: "PLANNER", items: [
    { key: "pl_board",     icon: "📋", label: "Task Board" },
    { key: "pl_timeline",  icon: "📅", label: "Season Timeline" },
    { key: "pl_checklist", icon: "✅", label: "Admin Checklist" },
    { key: "pl_modlog",      icon: "📦", label: "Mod Changelog" },
    { key: "pl_settingslog", icon: "⚙️", label: "Settings Changelog" },
  ]},
  { label: "SERVER CONFIG", items: [
    { key: "sc_mods",        icon: "🔧", label: "Mods & Maps" },
    { key: "sc_server",      icon: "🖥️", label: "Server Settings" },
    { key: "sc_world",       icon: "🌍", label: "World & Loot" },
    { key: "sc_zombies",     icon: "🧟", label: "Zombies" },
    { key: "sc_skills",      icon: "📈", label: "Skills & XP" },
    { key: "sc_vehicles",    icon: "🚗", label: "Vehicles & Animals" },
    { key: "sc_log",         icon: "📋", label: "Activity Log" },
  ]},
];

const PANELS = {
  overview:    OverviewTab,
  server:      ServerTab,
  shop:        ShopTab,
  treasury:    TreasuryTab,
  economy:     EconomyTab,
  dotd:        DotdTab,
  hunt:        HuntTab,
  players:     PlayersTab,
  games:       GamesTab,
  reputation:  ReputationTab,
  system:      SystemTab,
  sc_mods:     (props) => <ServerConfigTab {...props} initialTab="mods" />,
  sc_server:   (props) => <ServerConfigTab {...props} initialTab="server" />,
  sc_world:    (props) => <ServerConfigTab {...props} initialTab="world" />,
  sc_zombies:  (props) => <ServerConfigTab {...props} initialTab="zombies" />,
  sc_skills:   (props) => <ServerConfigTab {...props} initialTab="skills" />,
  sc_vehicles: (props) => <ServerConfigTab {...props} initialTab="vehicles" />,
  sc_log:      (props) => <ServerConfigTab {...props} initialTab="log" />,
  pl_board:    (props) => <PlannerTab {...props} initialTab="board" />,
  pl_timeline: (props) => <PlannerTab {...props} initialTab="timeline" />,
  pl_checklist:(props) => <PlannerTab {...props} initialTab="checklist" />,
  pl_modlog:   (props) => <PlannerTab {...props} initialTab="modlog" />,
  pl_settingslog: (props) => <PlannerTab {...props} initialTab="settingslog" />,
};

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

export default function AdminPanel() {
  const [page, setPage] = useState("overview");
  const [toasts, setToasts] = useState([]);
  const [panelLocked, setPanelLocked] = useState(null);
  const [panelPw, setPanelPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [onlineAdmins, setOnlineAdmins] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((msg, type = "info") => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Check panel password on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await fetch(`https://api.stateofundeadpurge.site:8443/api/admin/panel-auth/status`, { credentials: "include" }).then(r => r.json());
        if (!data.has_password || data.verified) {
          setPanelLocked(false);
        } else {
          setPanelLocked(true);
        }
      } catch {
        setPanelLocked(false);
      }
    })();
  }, []);

  // Heartbeat: tell backend which tab we're on every 10s
  useEffect(() => {
    if (panelLocked !== false) return; // Don't heartbeat until unlocked
    const beat = () => {
      fetch("https://api.stateofundeadpurge.site:8443/api/admin/presence/heartbeat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: page }),
      }).catch(() => {});
    };
    beat();
    const iv = setInterval(beat, 10000);
    return () => clearInterval(iv);
  }, [page, panelLocked]);

  // Fetch who's online every 10s
  useEffect(() => {
    if (panelLocked !== false) return;
    const fetchOnline = () => {
      fetch("https://api.stateofundeadpurge.site:8443/api/admin/presence/online", {
        credentials: "include",
      }).then(r => r.json()).then(d => setOnlineAdmins(d.online || [])).catch(() => {});
    };
    fetchOnline();
    const iv = setInterval(fetchOnline, 10000);
    return () => clearInterval(iv);
  }, [panelLocked]);

  const adminsOnTab = (tabKey) => onlineAdmins.filter(a => a.tab === tabKey);

  const PresenceAvatar = ({ admin, size = 22 }) => {
    const info = ADMINS[admin.discord_id] || { name: "Unknown", color: "#4a5568", initials: "??" };
    return (
      <div title={`${info.name} is here`} style={{
        width: size, height: size, borderRadius: size / 2,
        background: info.color + "33", border: `2px solid ${info.color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontFamily: "var(--mono)", color: info.color,
        flexShrink: 0, position: "relative",
      }}>
        {info.initials}
        <div style={{
          position: "absolute", bottom: -1, right: -1, width: 7, height: 7,
          borderRadius: 4, background: "var(--green)",
          border: "1.5px solid var(--surface)", boxShadow: "0 0 4px var(--green)",
        }} />
      </div>
    );
  };

  // ── WebSocket for real-time updates ──────────────────────────
  const [wsConnected, setWsConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => {
    if (panelLocked !== false) return;

    const connect = () => {
      try {
        const ws = new WebSocket("wss://api.stateofundeadpurge.site:8443/ws/admin");
        wsRef.current = ws;

        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          // Auto-reconnect after 5s
          setTimeout(connect, 5000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.event === "change") {
              // Trigger re-render of the active panel
              setRefreshKey(k => k + 1);
              // Show toast for changes by other admins
              if (msg.data?.description) {
                const adminName = ADMINS[msg.data.admin_id]?.name || "Someone";
                toast(`${adminName}: ${msg.data.description}`, "info");
              }
            }
          } catch {}
        };
      } catch {}
    };

    connect();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [panelLocked]);

  const verifyPassword = async () => {
    setPwError("");
    try {
      const r = await fetch(`https://api.stateofundeadpurge.site:8443/api/admin/panel-auth/verify`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: panelPw }),
      });
      if (r.ok) {
        setPanelLocked(false);
      } else {
        setPwError("Wrong password");
      }
    } catch { setPwError("Connection error"); }
  };

  // Show password gate
  if (panelLocked === null) {
    return <div className="ap"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><div style={{ fontFamily: "var(--mono)", color: "var(--textdim)", letterSpacing: 2 }}>LOADING...</div></div></div>;
  }

  if (panelLocked) {
    return (
      <div className="ap">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", padding: 40, width: 400, maxWidth: "90vw", textAlign: "center" }}>
            <div style={{ position: "relative", overflow: "hidden", marginBottom: 24 }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 32, letterSpacing: 4, color: "var(--accent)" }}>SOUP ADMIN</div>
              <div style={{ fontSize: 11, color: "var(--textdim)", fontFamily: "var(--mono)", marginTop: 4 }}>Enter panel password to continue</div>
            </div>
            <input
              type="password"
              value={panelPw}
              onChange={e => { setPanelPw(e.target.value); setPwError(""); }}
              onKeyDown={e => e.key === "Enter" && verifyPassword()}
              placeholder="Password"
              autoFocus
              style={{
                width: "100%", background: "var(--bg)", border: `1px solid ${pwError ? "var(--red)" : "var(--border)"}`,
                color: "var(--text)", padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 14,
                textAlign: "center", letterSpacing: 3, outline: "none", marginBottom: 12,
              }}
            />
            {pwError && <div style={{ fontSize: 11, color: "var(--red)", fontFamily: "var(--mono)", marginBottom: 12 }}>{pwError}</div>}
            <button onClick={verifyPassword} style={{
              width: "100%", padding: "10px", fontFamily: "var(--mono)", fontSize: 12, letterSpacing: 2,
              textTransform: "uppercase", background: "rgba(200,168,75,0.1)", border: "1px solid var(--accent)",
              color: "var(--accent)", cursor: "pointer",
            }}>UNLOCK</button>
          </div>
        </div>
      </div>
    );
  }

  const ActivePanel = PANELS[page] || OverviewTab;

  return (
    <div className="ap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ap-hd">
        <div className="ap-logo">SOUP ADMIN</div>
        <span className="ap-hd-badge">v2.0</span>
        {/* Online admins */}
        {onlineAdmins.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 16 }}>
            {onlineAdmins.map(a => <PresenceAvatar key={a.discord_id} admin={a} size={24} />)}
            <span style={{ fontSize: 10, color: "var(--green)", fontFamily: "var(--mono)", marginLeft: 4 }}>
              {onlineAdmins.length} online
            </span>
          </div>
        )}
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
                  {adminsOnTab(item.key).length > 0 && (
                    <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                      {adminsOnTab(item.key).map(a => {
                        const info = ADMINS[a.discord_id] || { color: "#4a5568" };
                        return <div key={a.discord_id} title={a.name} style={{
                          width: 8, height: 8, borderRadius: 4,
                          background: info.color, boxShadow: `0 0 4px ${info.color}`,
                        }} />;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <main className="ap-main">
          <ActivePanel key={refreshKey} toast={toast} />
        </main>
      </div>
      <Toasts items={toasts} />
    </div>
  );
}
