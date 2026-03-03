"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

type BoardType = "ingame" | "wolf" | "quiz" | "rps" | "c4";
type IngameTab = "kills" | "overall" | "deaths" | "survived" | "bestlife" | "factions";
type GameTab = "pvp" | "zombita" | "coins";

function medal(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `${i + 1}.`;
}
function fmtTime(s: number) {
  if (!s || s <= 0) return "—";
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function timeAgo(ts: number) {
  if (!ts) return "";
  const diff = Math.floor(Date.now()/1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}
function rc(i: number) {
  if (i===0) return "text-[#e6e6e6]";
  if (i===1) return "text-[#b0b0b0]";
  if (i===2) return "text-[#999]";
  return "text-[#777]";
}

export default function LeaderboardPage() {
  const [board, setBoard] = useState<BoardType>("ingame");
  const [ingameTab, setIngameTab] = useState<IngameTab>("kills");
  const [rpsTab, setRpsTab] = useState<GameTab>("pvp");
  const [c4Tab, setC4Tab] = useState<GameTab>("pvp");
  const [ingame, setIngame] = useState<any>(null);
  const [wolf, setWolf] = useState<any[]>([]);
  const [quiz, setQuiz] = useState<any[]>([]);
  const [rps, setRps] = useState<any>(null);
  const [c4, setC4] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/rankings`).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(`${API}/api/leaderboard`).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(`${API}/api/quiz/leaderboard`).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(`${API}/api/stats/rps`).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(`${API}/api/stats/connect4`).then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([ing,wlf,qz,rp,c])=>{
      setIngame(ing);
      setWolf(Array.isArray(wlf)?wlf:(wlf?.data||wlf?.players||[]));
      setQuiz(Array.isArray(qz)?qz:(qz?.data||qz?.players||[]));
      setRps(rp); setC4(c); setLoading(false);
    });
  }, []);

  const players = ingame?.players || [];
  const factions = ingame?.factions || [];
  const rpsBoard = rps?.leaderboard || [];
  const c4Board = c4?.leaderboard || [];

  const tabBtn = (active: boolean, onClick: ()=>void, label: string) => (
    <button onClick={onClick}
      className={`px-4 py-2 text-[0.72rem] tracking-[0.1em] uppercase bg-transparent border-none border-b-2 -mb-px cursor-pointer font-[inherit] transition-all ${active?"text-[#e6e6e6] border-b-2 border-[#4a7c59]":"text-[#555] border-transparent hover:text-[#e6e6e6]"}`}>
      {label}
    </button>
  );

  function PlayerTable({rows, valueFn, colHeader}: {rows:any[], valueFn:(p:any)=>string, colHeader:string}) {
    if (!rows.length) return <p className="text-[#555] font-mono text-sm italic">No data yet.</p>;
    return (
      <table className="lb-table">
        <thead><tr><th className="w-10"/><th>Player</th><th className="text-right">{colHeader}</th></tr></thead>
        <tbody>
          {rows.map((p,i)=>(
            <tr key={i} className={`lb-row ${rc(i)}`}>
              <td className="text-center text-sm">{medal(i)}</td>
              <td><a href={`/player?id=${encodeURIComponent(p.name)}`} className="hover:text-[#4a7c59] transition-colors">{p.name}</a>{p.faction&&<span className="text-[0.68rem] text-[#4a7c59] ml-2">[{p.faction}]</span>}</td>
              <td className="text-right font-mono">{valueFn(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  function GameTable({rows, c1, c2, h1, h2}: {rows:any[], c1:(p:any)=>string, c2:(p:any)=>string, h1:string, h2:string}) {
    if (!rows.length) return <p className="text-[#555] font-mono text-sm italic">No games recorded yet.</p>;
    return (
      <table className="lb-table">
        <thead><tr><th className="w-10"/><th>Player</th><th className="text-right">{h1}</th><th className="text-right">{h2}</th></tr></thead>
        <tbody>
          {rows.map((p,i)=>(
            <tr key={i} className={`lb-row ${rc(i)}`}>
              <td className="text-center text-sm">{medal(i)}</td>
              <td><a href={`/player?id=${encodeURIComponent(p.name)}`} className="hover:text-[#4a7c59] transition-colors">{p.name}</a></td>
              <td className="text-right font-mono text-xs">{c1(p)}</td>
              <td className="text-right font-mono text-xs">{c2(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <main className="max-w-[720px] mx-auto px-6 py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Leaderboard</h1>
        <p className="text-[#777] text-[0.85rem]">Season 1 — New Dawn</p>
      </section>
      <div className="divider"/>

      {/* Board switcher */}
      <div className="flex gap-2 flex-wrap mb-10">
        {([["ingame","⚔️ In-Game"],["wolf","🐺 Werewolf"],["quiz","🧠 Quizarium"],["rps","🪨 RPS"],["c4","🔴 Connect4"]] as [BoardType,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setBoard(id)}
            className={`px-4 py-[0.45rem] text-[0.72rem] tracking-[0.1em] uppercase border font-[inherit] cursor-pointer transition-all ${board===id?"border-[#4a7c59] text-[#4a7c59]":"border-[#222] text-[#555] hover:border-[#444] hover:text-[#e6e6e6]"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="font-mono text-[#555] text-sm">loading...</p> : <>

        {board==="ingame" && <div>
          {ingame?.updatedAt && <p className="text-[0.72rem] text-[#444] mb-4">Updated {timeAgo(ingame.updatedAt)}</p>}
          <div className="flex gap-0 border-b border-[#222] mb-6 flex-wrap">
            {tabBtn(ingameTab==="kills",()=>setIngameTab("kills"),"⚔️ Kills")}
            {tabBtn(ingameTab==="overall",()=>setIngameTab("overall"),"💀 All-Time")}
            {tabBtn(ingameTab==="deaths",()=>setIngameTab("deaths"),"🪦 Deaths")}
            {tabBtn(ingameTab==="survived",()=>setIngameTab("survived"),"⏳ Survived")}
            {tabBtn(ingameTab==="bestlife",()=>setIngameTab("bestlife"),"🏆 Best Life")}
            {tabBtn(ingameTab==="factions",()=>setIngameTab("factions"),"🏴 Factions")}
          </div>
          {ingameTab==="kills"    && <PlayerTable rows={[...players].sort((a,b)=>(b.kills||0)-(a.kills||0)).slice(0,10)} valueFn={p=>`${(p.kills||0).toLocaleString()} kills`} colHeader="Kills"/>}
          {ingameTab==="overall"  && <PlayerTable rows={[...players].sort((a,b)=>(b.overallKills||0)-(a.overallKills||0)).slice(0,10)} valueFn={p=>`${(p.overallKills||0).toLocaleString()} kills`} colHeader="All-Time Kills"/>}
          {ingameTab==="deaths"   && <PlayerTable rows={[...players].sort((a,b)=>(b.deaths||0)-(a.deaths||0)).slice(0,10)} valueFn={p=>`${p.deaths||0} times`} colHeader="Deaths"/>}
          {ingameTab==="survived" && <PlayerTable rows={[...players].sort((a,b)=>(b.currentLife||0)-(a.currentLife||0)).slice(0,10)} valueFn={p=>fmtTime(p.currentLife||0)} colHeader="Current Life"/>}
          {ingameTab==="bestlife" && <PlayerTable rows={[...players].sort((a,b)=>(b.longestLife||0)-(a.longestLife||0)).slice(0,10)} valueFn={p=>fmtTime(p.longestLife||0)} colHeader="Best Life"/>}
          {ingameTab==="factions" && (factions.length
            ? <table className="lb-table"><thead><tr><th className="w-10"/><th>Faction</th><th className="text-right">Kills</th><th className="text-right">Members</th></tr></thead>
                <tbody>{[...factions].sort((a,b)=>b.kills-a.kills).slice(0,10).map((f:any,i:number)=>(
                  <tr key={i} className={`lb-row ${rc(i)}`}><td className="text-center text-sm">{medal(i)}</td><td>{f.name}</td><td className="text-right font-mono">{(f.kills||0).toLocaleString()}</td><td className="text-right font-mono text-[#555]">{f.members||0}</td></tr>
                ))}</tbody></table>
            : <p className="text-[#555] font-mono text-sm italic">No factions yet.</p>
          )}
        </div>}

        {board==="wolf" && (wolf.filter((p:any)=>p.games_played>0).length
          ? <table className="lb-table"><thead><tr><th/><th>Player</th><th className="text-right">Wins</th><th className="text-right">Games</th><th className="text-right">Win %</th><th className="text-right">Survived</th></tr></thead>
              <tbody>{wolf.filter((p:any)=>p.games_played>0).map((p:any,i:number)=>(
                <tr key={i} className={`lb-row ${rc(i)}`}><td className="text-center text-sm">{medal(i)}</td><td><a href={`/player?id=${encodeURIComponent(p.display_name)}`} className="hover:text-[#4a7c59] transition-colors">{p.display_name}</a></td><td className="text-right font-mono">{p.games_won}</td><td className="text-right font-mono">{p.games_played}</td><td className="text-right font-mono">{Math.round((p.games_won/p.games_played)*100)}%</td><td className="text-right font-mono">{p.times_survived}</td></tr>
              ))}</tbody></table>
          : <p className="text-[#555] font-mono text-sm italic">No games recorded yet.</p>
        )}

        {board==="quiz" && (quiz.length
          ? <table className="lb-table"><thead><tr><th/><th>Player</th><th className="text-right">Points</th><th className="text-right">Wins</th><th className="text-right">Correct</th><th className="text-right">Accuracy</th></tr></thead>
              <tbody>{quiz.map((p:any,i:number)=>(
                <tr key={i} className={`lb-row ${rc(i)}`}><td className="text-center text-sm">{medal(i)}</td><td><a href={`/player?id=${encodeURIComponent(p.display_name)}`} className="hover:text-[#4a7c59] transition-colors">{p.display_name}</a></td><td className="text-right font-mono">{p.total_points}</td><td className="text-right font-mono">{p.games_won}</td><td className="text-right font-mono">{p.correct_answers}</td><td className="text-right font-mono">{p.total_answers>0?Math.round((p.correct_answers/p.total_answers)*100)+'%':'—'}</td></tr>
              ))}</tbody></table>
          : <p className="text-[#555] font-mono text-sm italic">No quiz games yet.</p>
        )}

        {board==="rps" && <div>
          <div className="flex gap-0 border-b border-[#222] mb-6">
            {tabBtn(rpsTab==="pvp",()=>setRpsTab("pvp"),"👥 vs Players")}
            {tabBtn(rpsTab==="zombita",()=>setRpsTab("zombita"),"🧟 vs Zombita")}
            {tabBtn(rpsTab==="coins",()=>setRpsTab("coins"),"💰 Coins")}
          </div>
          {rpsTab==="pvp"     && <GameTable rows={[...rpsBoard].sort((a:any,b:any)=>b.wins-a.wins)} c1={p=>`${p.wins}W / ${p.losses}L / ${p.draws}D`} c2={p=>`${p.win_rate}%`} h1="Record" h2="Win %"/>}
          {rpsTab==="zombita" && <GameTable rows={[...rpsBoard].sort((a:any,b:any)=>b.vs_zombita.wins-a.vs_zombita.wins)} c1={p=>`${p.vs_zombita.wins}W / ${p.vs_zombita.losses}L / ${p.vs_zombita.draws}D`} c2={p=>{const t=p.vs_zombita.wins+p.vs_zombita.losses+p.vs_zombita.draws;return t>0?Math.round((p.vs_zombita.wins/t)*100)+'%':'—';}} h1="vs Zombita" h2="Win %"/>}
          {rpsTab==="coins"   && <GameTable rows={[...rpsBoard].sort((a:any,b:any)=>b.coins_net-a.coins_net)} c1={p=>`${p.coins_won.toLocaleString()} 🟤`} c2={p=>`${p.coins_net>=0?'+':''}${p.coins_net.toLocaleString()}`} h1="Coins Won" h2="Net"/>}
        </div>}

        {board==="c4" && <div>
          <div className="flex gap-0 border-b border-[#222] mb-6">
            {tabBtn(c4Tab==="pvp",()=>setC4Tab("pvp"),"👥 vs Players")}
            {tabBtn(c4Tab==="zombita",()=>setC4Tab("zombita"),"🧟 vs Zombita")}
            {tabBtn(c4Tab==="coins",()=>setC4Tab("coins"),"💰 Coins")}
          </div>
          {c4Tab==="pvp"     && <GameTable rows={[...c4Board].sort((a:any,b:any)=>b.wins-a.wins)} c1={p=>`${p.wins}W / ${p.losses}L / ${p.draws}D`} c2={p=>`${p.win_rate}%`} h1="Record" h2="Win %"/>}
          {c4Tab==="zombita" && <GameTable rows={[...c4Board].sort((a:any,b:any)=>b.vs_zombita.wins-a.vs_zombita.wins)} c1={p=>`${p.vs_zombita.wins}W / ${p.vs_zombita.losses}L / ${p.vs_zombita.draws}D`} c2={p=>{const t=p.vs_zombita.wins+p.vs_zombita.losses+p.vs_zombita.draws;return t>0?Math.round((p.vs_zombita.wins/t)*100)+'%':'—';}} h1="vs Zombita" h2="Win %"/>}
          {c4Tab==="coins"   && <GameTable rows={[...c4Board].sort((a:any,b:any)=>b.coins_net-a.coins_net)} c1={p=>`${p.coins_won.toLocaleString()} 🟤`} c2={p=>`${p.coins_net>=0?'+':''}${p.coins_net.toLocaleString()}`} h1="Coins Won" h2="Net"/>}
        </div>}

      </>}

      <div className="divider"/>
      <p className="text-[#555] text-[0.85rem] font-mono italic">In-game stats update every 5 minutes from the live server.</p>
    </main>
  );
}
