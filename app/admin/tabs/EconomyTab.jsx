"use client";
// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi, postApi, fmt, bronzeToCoins, relTime, Title, TW, B, Inp, FB, Empty, Load, EvBadge } from "./shared";

// ── Player search dropdown ────────────────────────────────────────────────────
const PlayerSearch = ({ players, value, onChange, placeholder = "Search by name, username, in-game name..." }) => {
  const [query, setQuery] = useState(value?.display_name || "");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.length < 1 ? players.slice(0, 20) : players.filter(p => {
    const q = query.toLowerCase();
    return p.display_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q) ||
      p.ingame_name?.toLowerCase().includes(q) ||
      String(p.discord_id).includes(q);
  }).slice(0, 20);

  const select = (p) => {
    onChange(p);
    setQuery(p.display_name);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="ap-fg">
        <label className="ap-fl">Player</label>
        <input
          className="ap-inp"
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "var(--surface)", border: "1px solid var(--border)", maxHeight: 220, overflowY: "auto" }}>
          {filtered.map(p => (
            <div key={p.discord_id} onMouseDown={() => select(p)} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{p.display_name}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>
                  {p.username ? `@${p.username}` : ""}{p.ingame_name ? ` · 🧟 ${p.ingame_name}` : ""}
                </div>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--textdim)" }}>{p.discord_id}</div>
            </div>
          ))}
        </div>
      )}
      {value && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)", marginTop: 4 }}>
          ✓ {value.display_name} selected
        </div>
      )}
    </div>
  );
};

export default function EconomyTab({ toast }) {
  const [tab, setTab] = useState("give");
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(true);

  // Give state
  const [givePlayer, setGivePlayer] = useState(null);
  const [giveAmt, setGiveAmt] = useState("");
  const [giveReason, setGiveReason] = useState("");
  const [giveSource, setGiveSource] = useState("treasury"); // "treasury" or "grant"

  // Take state
  const [takePlayer, setTakePlayer] = useState(null);
  const [takeAmt, setTakeAmt] = useState("");
  const [takeReason, setTakeReason] = useState("");

  // Lookup state
  const [txns, setTxns] = useState([]);
  const [txnPlayer, setTxnPlayer] = useState(null);
  const [txnLoading, setTxnLoading] = useState(false);

  // All txns
  const [allTxns, setAllTxns] = useState([]);
  const [allLoading, setAllLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchApi("/api/players");
        setPlayers(data.players || []);
      } catch {}
      setPlayersLoading(false);
    })();
  }, []);

  const give = async () => {
    if (!givePlayer) { toast("Select a player first", "error"); return; }
    if (!giveAmt) { toast("Enter an amount", "error"); return; }
    try {
      const r = await postApi("/api/admin/economy/give-by-name", {
        discord_id: givePlayer.discord_id,
        amount: parseInt(giveAmt),
        reason: giveReason || (giveSource === "treasury" ? "Admin treasury payout" : "Admin grant"),
        from_treasury: giveSource === "treasury",
      });
      const sourceLabel = giveSource === "treasury" ? "from treasury" : "admin grant (cheat)";
      toast(`✅ Sent ${fmt(giveAmt)} 🟤 to ${r.player} [${sourceLabel}]`, "success");
      setGiveAmt(""); setGiveReason("");
    } catch (e) { toast(e.message, "error"); }
  };

  const take = async () => {
    if (!takePlayer) { toast("Select a player first", "error"); return; }
    if (!takeAmt) { toast("Enter an amount", "error"); return; }
    try {
      const r = await postApi("/api/admin/economy/take-by-name", {
        discord_id: takePlayer.discord_id,
        amount: parseInt(takeAmt),
        reason: takeReason || "Admin deduction",
      });
      toast(`➖ Took ${fmt(takeAmt)} 🟤 from ${r.player}`, "success");
      setTakeAmt(""); setTakeReason("");
    } catch (e) { toast(e.message, "error"); }
  };

  const loadPlayerTxns = async () => {
    if (!txnPlayer) { toast("Select a player first", "error"); return; }
    setTxnLoading(true);
    try {
      const r = await fetchApi(`/api/admin/economy/player-transactions?discord_id=${txnPlayer.discord_id}&limit=50`);
      setTxns(r.transactions || []);
    } catch (e) { toast(e.message, "error"); }
    setTxnLoading(false);
  };

  const loadAllTxns = useCallback(async () => {
    setAllLoading(true);
    try { const r = await fetchApi("/api/admin/economy/transactions?limit=100"); setAllTxns(r.transactions || []); } catch {}
    setAllLoading(false);
  }, []);

  useEffect(() => { if (tab === "log") loadAllTxns(); }, [tab, loadAllTxns]);

  const PRESETS = [500, 1000, 5000, 10000, 50000];

  return (<>
    <Title t="WALLETS" s="give · take · transaction history" />
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {[{ k: "give", l: "💸 Give / Take" }, { k: "lookup", l: "🔍 Player Lookup" }, { k: "log", l: "📋 All Transactions" }].map(({ k, l }) =>
        <button key={k} className={`ap-ft ${tab === k ? "act" : ""}`} onClick={() => setTab(k)}>{l}</button>
      )}
    </div>

    {tab === "give" && <div className="ap-2c">
      <FB title="GIVE COINS">
        <div className="ap-note">
          <strong style={{ color: "var(--text)" }}>From Treasury</strong> — deducts from the treasury pool, legitimate payout.<br />
          <strong style={{ color: "var(--orange)" }}>Admin Grant (cheat)</strong> — creates coins from nothing, bypasses treasury. Use for testing or corrections only.
        </div>

        {/* Source selector */}
        <div style={{ display: "flex", gap: 8, margin: "12px 0 20px" }}>
          <button onClick={() => setGiveSource("treasury")} style={{
            flex: 1, padding: "10px 16px", border: `2px solid ${giveSource === "treasury" ? "var(--green)" : "var(--border)"}`,
            background: giveSource === "treasury" ? "var(--green)11" : "transparent",
            color: giveSource === "treasury" ? "var(--green)" : "var(--textdim)",
            fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1, cursor: "pointer", borderRadius: 2,
          }}>🏦 FROM TREASURY</button>
          <button onClick={() => setGiveSource("grant")} style={{
            flex: 1, padding: "10px 16px", border: `2px solid ${giveSource === "grant" ? "var(--orange)" : "var(--border)"}`,
            background: giveSource === "grant" ? "var(--orange)11" : "transparent",
            color: giveSource === "grant" ? "var(--orange)" : "var(--textdim)",
            fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1, cursor: "pointer", borderRadius: 2,
          }}>⚡ ADMIN GRANT (CHEAT)</button>
        </div>

        {playersLoading ? <Load /> : <PlayerSearch players={players} value={givePlayer} onChange={setGivePlayer} />}
        <Inp label="Amount (bronze)" type="number" placeholder="5000" value={giveAmt} onChange={e => setGiveAmt(e.target.value)} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 16px" }}>
          {PRESETS.map(n => <button key={n} className="ap-pre" onClick={() => setGiveAmt(String(n))}>{fmt(n)}</button>)}
        </div>
        <Inp label="Reason (optional)" placeholder="Event prize, compensation..." value={giveReason} onChange={e => setGiveReason(e.target.value)} />
        <B c={giveSource === "treasury" ? "green" : "orange"} onClick={give}>
          {giveSource === "treasury" ? "🏦 Give from Treasury" : "⚡ Admin Grant (Cheat)"}
        </B>
      </FB>

      <FB title="TAKE COINS">
        <div className="ap-note">Deducts directly from the player's wallet. Does not affect treasury.</div>
        {playersLoading ? <Load /> : <PlayerSearch players={players} value={takePlayer} onChange={setTakePlayer} />}
        <Inp label="Amount (bronze)" type="number" placeholder="5000" value={takeAmt} onChange={e => setTakeAmt(e.target.value)} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 16px" }}>
          {PRESETS.map(n => <button key={n} className="ap-pre" onClick={() => setTakeAmt(String(n))}>{fmt(n)}</button>)}
        </div>
        <Inp label="Reason (optional)" placeholder="Penalty, correction..." value={takeReason} onChange={e => setTakeReason(e.target.value)} />
        <B c="red" onClick={take}>➖ Take Coins from Wallet</B>
      </FB>
    </div>}

    {tab === "lookup" && <FB title="PLAYER TRANSACTION HISTORY">
      <div className="ap-note info">Search by display name, username, or in-game name.</div>
      {playersLoading ? <Load /> : <PlayerSearch players={players} value={txnPlayer} onChange={setTxnPlayer} />}
      <div style={{ marginTop: 12 }}>
        <B c="blue" onClick={loadPlayerTxns}>Load Transactions</B>
      </div>
      {txnLoading ? <Load /> : txns.length > 0 ? <div style={{ marginTop: 16 }}>{txns.map((e, i) => <div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span>
        <EvBadge type={e.type || e.event_type || "adjust"} />
        <span className="ap-lr-d">{e.description || "—"}</span>
        <span className={`ap-lr-v ${e.amount > 0 ? "pos" : "neg"}`}>{e.amount > 0 ? "+" : ""}{fmt(e.amount)} 🟤</span>
        <span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span>
      </div>)}</div> : txnPlayer && !txnLoading ? <Empty text="no transactions found" /> : null}
    </FB>}

    {tab === "log" && <TW title="ALL TRANSACTIONS" right={<B c="ghost" sm onClick={loadAllTxns}>↻</B>}>
      {allLoading ? <Load /> : allTxns.length ? <div>{allTxns.map((e, i) => <div key={i} className="ap-lr">
        <span className="ap-lr-t">{relTime(e.timestamp)}</span>
        <EvBadge type={e.type || e.event_type || "adjust"} />
        <span className="ap-lr-d">{e.description || "—"}</span>
        <span className="ap-lr-p">{e.display_name || `#${e.discord_id}` || "—"}</span>
        <span className={`ap-lr-v ${e.amount > 0 ? "pos" : "neg"}`}>{e.amount > 0 ? "+" : ""}{fmt(e.amount)} 🟤</span>
        <span style={{ color: "var(--textdim)", fontFamily: "var(--mono)", fontSize: 11, minWidth: 80, textAlign: "right" }}>→ {fmt(e.balance_after)}</span>
      </div>)}</div> : <Empty text="no transactions found" />}
    </TW>}
  </>);
}
