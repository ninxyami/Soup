"use client";
// @ts-nocheck
// Portraits: players' own pictures. Nothing shows anywhere until it's approved here. routers/portraits.py
// Approve: it ships with the next pack, at the next restart. Reject: the file is deleted, the player reads the reason.
// Remove: an approved picture goes at once for everyone who picked it, in about a minute in game.
import { useState, useEffect, useCallback } from "react";
import { API } from "@/lib/constants";
import { fetchApi, postApi, relTime, Title, B, Load, Empty } from "./shared";

const mono = { fontFamily: "var(--mono)", fontSize: 12 };
const dim = { ...mono, color: "var(--textdim)" };
const VIEWS = [["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"], ["removed", "Removed"]];

function Card({ u, view, toast, reload }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (what, body) => {
    setBusy(true);
    try {
      await postApi(`/api/admin/portraits/${u.id}/${what}`, body || {});
      toast(`${u.account}: ${what} done`, "success");
      reload();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const hasFile = view === "pending" || view === "approved";
  return (
    <div style={{ display: "flex", gap: 14, border: "1px solid var(--border)", padding: 12, background: "var(--bg2)", flexWrap: "wrap" }}>
      {hasFile
        ? <img src={`${API}/api/portraits/upload/${u.id}/image`} alt={`Upload ${u.id}`} width={160} height={160} style={{ objectFit: "cover", background: "#000" }} />
        : <div style={{ width: 160, height: 160, ...dim, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)" }}>file deleted</div>}
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{u.account}</div>
        <div style={dim}>#{u.id} · sent {relTime(u.created_at)}{u.decided_by ? ` · ${view} by ${u.decided_by}` : ""}</div>
        {u.reason && <div style={{ ...mono, marginTop: 6 }}>Reason: {u.reason}</div>}
        {hasFile && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            {[96, 58, 32].map((s) => <img key={s} src={`${API}/api/portraits/upload/${u.id}/image`} alt="" width={s} height={s} style={{ objectFit: "cover" }} />)}
          </div>
        )}
        {view === "pending" && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <B c="green" sm disabled={busy} onClick={() => act("approve")}>Approve</B>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why not? The player reads this." maxLength={200}
                   style={{ ...mono, flex: 1, minWidth: 180, padding: "4px 8px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }} />
            <B c="red" sm disabled={busy || !reason.trim()} onClick={() => act("reject", { reason })}>Reject</B>
          </div>
        )}
        {view === "approved" && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it's coming off (staff log)" maxLength={200}
                   style={{ ...mono, flex: 1, minWidth: 180, padding: "4px 8px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }} />
            <B c="red" sm disabled={busy} onClick={() => { if (window.confirm(`Remove ${u.account}'s picture?`)) act("remove", { reason }); }}>Remove</B>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortraitsTab({ toast }) {
  const [view, setView] = useState("pending");
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    setData(null);
    fetchApi(`/api/admin/portraits?status=${view}`).then(setData).catch((e) => { toast?.(e.message, "error"); setData({ uploads: [], rules: [] }); });
  }, [view, toast]);
  useEffect(load, [load]);
  return (
    <div>
      <Title t="Portraits" s="Players' own pictures. Nothing shows anywhere until it's approved here." />
      <div style={{ display: "flex", gap: 6, margin: "12px 0", flexWrap: "wrap" }}>
        {VIEWS.map(([id, label]) => <B key={id} c={view === id ? "gold" : "ghost"} sm onClick={() => setView(id)}>{label}</B>)}
      </div>
      {data?.rules?.length > 0 && <div style={{ ...dim, marginBottom: 12 }}>{data.rules.join(" ")}</div>}
      {!data ? <Load /> : data.uploads.length === 0 ? <Empty text="Nothing here." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.uploads.map((u) => <Card key={u.id} u={u} view={view} toast={toast} reload={load} />)}
        </div>
      )}
    </div>
  );
}
