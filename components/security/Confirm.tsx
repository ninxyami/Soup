// @ts-nocheck
"use client";
// components/security/Confirm.tsx - the yes/no box for every action on /security. It says exactly what will happen,
// and can ask for a note (a reason the player sees, or an admin note on a cleared finding).
import { useEffect, useState } from "react";
import { C, DISPLAY } from "./lib";

// ask = {title, lines: [..], color, yes, note: {label, placeholder, required}} ; onYes(note) ; onNo()
export default function Confirm({ ask, onYes, onNo }) {
  const [note, setNote] = useState("");
  useEffect(() => { setNote(""); }, [ask]);
  useEffect(() => {
    if (!ask) return;
    const k = (e) => { if (e.key === "Escape") onNo(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [ask, onNo]);
  if (!ask) return null;
  const color = ask.color || C.gold;
  const blocked = ask.note?.required && !note.trim();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.72)" }} onClick={onNo}>
      <div role="dialog" aria-modal="true" className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto border p-5" onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, borderColor: C.line, borderTop: `3px solid ${color}` }}>
        <div className="leading-none" style={{ fontFamily: DISPLAY, fontSize: 28, letterSpacing: 1.5, color }}>{ask.title}</div>
        <div className="mt-3 flex flex-col gap-2 text-[0.9rem] leading-relaxed" style={{ color: C.text }}>
          {(ask.lines || []).map((l, i) => <p key={i} className="m-0">{l}</p>)}
        </div>
        {ask.note && (
          <label className="block mt-4">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.1em]" style={{ color: C.muted }}>{ask.note.label}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder={ask.note.placeholder || ""}
              className="mt-1 w-full font-mono text-[0.82rem] px-2.5 py-2 outline-none resize-y"
              style={{ background: "#080a0c", color: C.bright, border: `1px solid ${C.line}`, borderRadius: 2 }} />
          </label>
        )}
        <div className="flex flex-wrap justify-end gap-2 mt-5">
          <button onClick={onNo} className="font-mono text-[0.72rem] uppercase tracking-[0.12em] px-3 py-2 cursor-pointer"
            style={{ color: C.muted, border: `1px solid ${C.line}`, background: "transparent", borderRadius: 2 }}>Cancel</button>
          <button onClick={() => !blocked && onYes(note.trim())} disabled={blocked}
            className="font-mono text-[0.72rem] uppercase tracking-[0.12em] px-3 py-2 cursor-pointer disabled:opacity-40 disabled:cursor-default"
            style={{ color, border: `1px solid ${color}`, background: `${color}18`, borderRadius: 2 }}>{ask.yes || "Yes"}</button>
        </div>
      </div>
    </div>
  );
}
