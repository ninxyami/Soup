"use client";
// @ts-nocheck
// TREASURE (2026-10-19): the event with the phone page /p (contract in the PC kit docs). The admin bundle is public
// like the rest of the site, so this tab holds no story words, places or prizes: only controls.
// Start/end/test mode, the teams with their step, time in step and fails, reset a team, kick a member, unbind a
// member's real phone, and Nin's start picture (posted by the bot when the event starts).
// "Set start here" and the spot pools live in the in-game admin panel (Treasure tab), not here.
// Data: GET /api/admin/th/state, POST /api/admin/th/do {cmd, ...}, GET /api/admin/th/result/{id},
//       POST /api/admin/th/start_pic (multipart, field "file")
//       Spot pictures (Nin's own picture of a location 2 / final spot, served to the team instead of the map crop):
//       POST /api/admin/th/spot_pic?kind=loc2|final&x=&y=&z=[&cx=&cy=&size=] (multipart "file"), GET / DELETE ?x=&y=&z=
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi, postApi, fmtFull, API, Title, SC, TW, B, FB, Empty, Load } from "./shared";

const STEPS = [
  ["linking", "Forming the team"], ["call", "First call"], ["unlock", "Pattern unlock (web)"],
  ["mg1_signal", "Signal lock (web)"], ["mg1_photo", "Torn photo (web)"], ["go_loc2", "Going to location 2"],
  ["arrange", "Setting out the items"], ["scan", "Scanning the marker (web)"], ["code_horde", "Code horde"],
  ["mg2_cipher", "Cipher wheel (web)"], ["mg2_game", "Vial sort / wiring (web)"], ["go_final", "Going to the final spot"],
  ["finale", "Finale + hold the line"], ["lastcall", "Last call"], ["done", "Done"], ["broken", "Phone broken"],
];
const STEP_LABEL = Object.fromEntries(STEPS);
const STEP_NO = Object.fromEntries(STEPS.map(([k], i) => [k, i + 1]));

const dur = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${r}s` : `${r}s`;
};

// The stored 480x480 square of a spot picture, fetched with the admin cookie
// q: "x=..&y=..&z=.." for one spot, or "kind=final" for the default final picture
function SpotPreview({ q, at, label }) {
  const [url, setUrl] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true, made = "";
    setMissing(false);
    fetch(`${API}/api/admin/th/spot_pic?${q}&v=${at || 0}`, { credentials: "include" })
      .then(r => (r.ok ? r.blob() : null))
      .then(b => { if (!alive) return; if (b) { made = URL.createObjectURL(b); setUrl(made); } else setMissing(true); })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [q, at]);
  return url
    ? <img src={url} alt={label} style={{ width: 120, height: 120, objectFit: "cover", border: "1px solid var(--border)", display: "block" }} />
    : <div style={{ width: 120, height: 120, border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--textdim)", textAlign: "center" }}>{missing ? "no picture" : "loading..."}</div>;
}

// kind "final_default" = the default final picture (every final spot without its own): sent as kind=final, no x/y
function SpotPictures({ toast, spots, teams, reload, finalAt }) {
  const [kind, setKind] = useState("loc2");
  const [xyz, setXyz] = useState({ x: "", y: "", z: "0" });
  const [crop, setCrop] = useState({ cx: "", cy: "", size: "" });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [dims, setDims] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // spots the teams are using right now: one tap fills the form
  const used = [];
  for (const t of teams || []) for (const k of ["loc2", "final"]) {
    const p = t[k];
    if (p && (p.x || p.y) && !used.some(u => u.kind === k && u.x === p.x && u.y === p.y && u.z === (p.z || 0))) used.push({ kind: k, x: p.x, y: p.y, z: p.z || 0 });
  }

  const choose = (f) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    const u = URL.createObjectURL(f);
    setFile(f); setPreview(u); setDims(null);
    const im = new Image();
    im.onload = () => setDims({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = u;
  };
  const isInt = (v) => /^-?\d+$/.test(String(v));
  const isDefault = kind === "final_default";
  const ok = file && (isDefault || (isInt(xyz.x) && isInt(xyz.y) && isInt(xyz.z)));

  const upload = async () => {
    if (!ok) return;
    setSaving(true);
    try {
      const q = new URLSearchParams(isDefault ? { kind: "final" } : { kind, x: xyz.x, y: xyz.y, z: xyz.z });
      for (const k of ["cx", "cy", "size"]) if (String(crop[k]).trim() !== "") q.set(k, String(crop[k]).trim());
      const fd = new FormData();
      fd.append("file", file);
      await fetchApi(`/api/admin/th/spot_pic?${q}`, { method: "POST", body: fd });
      toast(isDefault ? "Default final picture saved" : `Picture saved for ${kind === "loc2" ? "location 2" : "the final picture of"} ${xyz.x}, ${xyz.y}, ${xyz.z}`, "success");
      setFile(null); setPreview(""); setDims(null); setCrop({ cx: "", cy: "", size: "" });
      reload();
    } catch (e) { toast("Upload failed: " + e.message, "error"); }
    setSaving(false);
  };
  const remove = async (sp) => {
    const back = sp.kind === "final" ? "the default final picture" : "the map crop";
    if (!confirm(`Remove the picture for ${sp.x}, ${sp.y}, ${sp.z}? Teams going there get ${back} again.`)) return;
    try {
      await fetchApi(`/api/admin/th/spot_pic?x=${sp.x}&y=${sp.y}&z=${sp.z}`, { method: "DELETE" });
      toast(`Picture removed, ${back} is back`, "success");
      reload();
    } catch (e) { toast("Remove failed: " + e.message, "error"); }
  };

  // the square the API will cut, same maths as zombita_treasure_map.spot_square: default the centre and the whole
  // short side, kept inside the picture
  let box = null;
  if (dims) {
    const short = Math.min(dims.w, dims.h);
    const side = Math.max(32, Math.min(Number(crop.size) || short, short));
    const cx = crop.cx !== "" ? Number(crop.cx) : dims.w / 2, cy = crop.cy !== "" ? Number(crop.cy) : dims.h / 2;
    const left = Math.min(Math.max(cx - side / 2, 0), dims.w - side), top = Math.min(Math.max(cy - side / 2, 0), dims.h - side);
    box = { left: (left / dims.w) * 100, top: (top / dims.h) * 100, w: (side / dims.w) * 100, h: (side / dims.h) * 100 };
  }

  return (
    <TW title="SPOT PICTURES" right={<span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>location 2 and final pictures</span>}>
      <div style={{ padding: 20 }}>
        <div className="ap-note">
          <b>Location 2:</b> a team that solves the torn photo sees a picture of its spot, by default a crop of our map
          render. Upload your own picture for a spot to use it instead (it becomes the 3x3 torn photo).<br />
          <b>Final:</b> the final picture is never a map crop of the real final spot. Every team gets the default
          final picture, unless you upload one for its own final spot.<br />
          Pictures are cut to a square (the biggest square in the middle, unless you set the centre and side).
          Spots are picked per team from the pools in the in-game admin panel, so a spot picture belongs to one x, y, z.
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16, padding: 10, border: "1px solid var(--border)", background: "var(--surface2)" }}>
          <SpotPreview q="kind=final" at={finalAt} label="default final picture" />
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.7 }}>
            <div style={{ color: "var(--accent)" }}>DEFAULT FINAL PICTURE</div>
            <div style={{ color: "var(--textdim)" }}>Shown to every team whose final spot has no picture of its own.</div>
            <div style={{ color: "var(--textdim)" }}>{finalAt ? `Changed ${fmtFull(finalAt)}` : "The one shipped with the bot."}</div>
            <B c="ghost" sm onClick={() => { setKind("final_default"); fileRef.current?.click(); }}>Replace it</B>
          </div>
        </div>
        {used.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>Spots teams use now:</span>
            {used.map(u => (
              <B key={`${u.kind}${u.x},${u.y},${u.z}`} c="ghost" sm onClick={() => { setKind(u.kind); setXyz({ x: String(u.x), y: String(u.y), z: String(u.z) }); }}>
                {u.kind === "loc2" ? "loc 2" : "final"} {u.x}, {u.y}, {u.z}
              </B>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="ap-fg"><label className="ap-fl">Spot</label>
            <select className="ap-sel" value={kind} onChange={e => setKind(e.target.value)}>
              <option value="loc2">Location 2 picture</option>
              <option value="final">Final picture, one final spot</option>
              <option value="final_default">Final picture, default for every team</option>
            </select>
          </div>
          {!isDefault && ["x", "y", "z"].map(k => (
            <div key={k} className="ap-fg"><label className="ap-fl">{k}</label>
              <input className="ap-inp" style={{ width: 90 }} value={xyz[k]} onChange={e => setXyz({ ...xyz, [k]: e.target.value.trim() })} placeholder={k === "z" ? "0" : ""} />
            </div>
          ))}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={e => { choose(e.target.files?.[0]); e.target.value = ""; }} />
          <B c="ghost" onClick={() => fileRef.current?.click()}>Choose picture</B>
          <B c="gold" disabled={!ok || saving} onClick={upload}>{saving ? "Uploading..." : "Upload"}</B>
        </div>
        {preview && (
          <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ position: "relative", display: "inline-block", maxWidth: 360, overflow: "hidden" }}>
              <img src={preview} alt="chosen picture" style={{ display: "block", maxWidth: "100%", maxHeight: 260, border: "1px solid var(--border)" }} />
              {box && <div style={{ position: "absolute", left: `${box.left}%`, top: `${box.top}%`, width: `${box.w}%`, height: `${box.h}%`, outline: "2px solid var(--accent)", boxShadow: "0 0 0 999px rgba(0,0,0,0.45)", pointerEvents: "none" }} />}
            </div>
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)", marginBottom: 8 }}>
                {file?.name} {dims ? `(${dims.w} x ${dims.h} px)` : ""}<br />The gold square is what the team will see.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["cx", "cy", "size"].map(k => (
                  <div key={k} className="ap-fg"><label className="ap-fl">{k === "size" ? "side px" : `${k} px`}</label>
                    <input className="ap-inp" style={{ width: 80 }} value={crop[k]} placeholder="auto" onChange={e => setCrop({ ...crop, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          {!spots?.length ? <Empty text="No spot pictures yet. Location 2 uses the map crop, the final uses the default final picture." /> : (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {spots.map(sp => (
                <div key={`${sp.x},${sp.y},${sp.z}`} style={{ border: "1px solid var(--border)", padding: 8, background: "var(--surface2)" }}>
                  <SpotPreview q={`x=${sp.x}&y=${sp.y}&z=${sp.z}`} at={sp.at} label={`picture for ${sp.x}, ${sp.y}, ${sp.z}`} />
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, margin: "6px 0" }}>
                    {sp.kind === "final" ? "Final" : "Location 2"}<br />{sp.x}, {sp.y}, {sp.z}<br /><span style={{ color: "var(--textdim)" }}>{sp.at ? fmtFull(sp.at) : ""}</span>
                  </div>
                  <B c="red" sm onClick={() => remove(sp)}>remove</B>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TW>
  );
}

export default function TreasureTab({ toast }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resetTo, setResetTo] = useState({});
  const [pic, setPic] = useState(null);
  const [picUrl, setPicUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [, tick] = useState(0);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try { setSt(await fetchApi("/api/admin/th/state")); setErr(""); }
    catch (e) { setErr(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => () => { if (picUrl) URL.revokeObjectURL(picUrl); }, [picUrl]);

  // queue a command for the game, then wait for its done line (the game polls every 2 s)
  const run = async (body, label) => {
    setBusy(true);
    try {
      const r = await postApi("/api/admin/th/do", body);
      toast(`${label}: sent, waiting for the game...`, "info");
      if (r?.id) {
        for (let i = 0; i < 15; i++) {
          await new Promise(res => setTimeout(res, 1500));
          const d = await fetchApi(`/api/admin/th/result/${r.id}`).catch(() => null);
          if (d && !d.pending && d.ok !== undefined) {
            toast(d.ok ? `${label}: done` : `${label}: ${d.msg || "the game said no"}`, d.ok ? "success" : "error");
            break;
          }
          if (i === 14) toast(`${label}: no answer from the game yet. Is the server up and treasure_on set?`, "error");
        }
      } else toast(`${label}: done`, "success");
      load();
    } catch (e) { toast(`${label}: ${e.message}`, "error"); }
    setBusy(false);
  };

  const start = (test) => {
    const msg = test
      ? "Start the event in TEST MODE?\n\nOnly admins can pick up a phone and only admins get hordes. Hints go to the admin channel."
      : "Start the event for EVERYONE?\n\nThe start scene appears at the saved start, and the bot posts the start picture.";
    if (confirm(msg)) run({ cmd: "event_start", test: test ? "1" : "0" }, test ? "Start (test)" : "Start");
  };
  const end = () => {
    if (confirm("End the event now?\n\nEvery phone still out breaks. It also ends by itself 4 hours after the start.")) run({ cmd: "event_end" }, "End");
  };
  const reset = (team) => {
    const to = resetTo[team.id] || team.step;
    if (confirm(`Put team ${team.id} back to "${STEP_LABEL[to] || to}"?`)) run({ cmd: "team_reset", team: team.id, to }, `Reset ${team.id}`);
  };
  const kick = (team, user) => {
    if (confirm(`Remove ${user} from team ${team.id}?`)) run({ cmd: "team_kick", team: team.id, user }, `Kick ${user}`);
  };
  const unbind = (team, user) => {
    if (confirm(`Unbind ${user}'s real phone?\n\nTheir QR link works again on the next device that opens it.`)) run({ cmd: "unbind", team: team.id, user }, `Unbind ${user}`);
  };

  const choosePic = (f) => {
    if (!f) return;
    if (picUrl) URL.revokeObjectURL(picUrl);
    setPic(f);
    setPicUrl(URL.createObjectURL(f));
  };
  const uploadPic = async () => {
    if (!pic) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", pic);
      await fetchApi("/api/admin/th/start_pic", { method: "POST", body: fd });
      toast("Start picture saved. The bot posts it when the event starts.", "success");
      setPic(null);
    } catch (e) { toast("Upload failed: " + e.message, "error"); }
    setUploading(false);
  };

  if (loading) return <><Title t="TREASURE" s="event phones" /><Load /></>;

  const ev = st?.event || {};
  const teams = st?.teams || [];
  const now = Date.now() / 1000;
  const age = st?.ts ? now - st.ts : null;
  const left = ev.on && ev.ends ? ev.ends - now : 0;

  return (<>
    <Title t="TREASURE" s="event phones · teams up to 4" />
    {err && <div className="ap-note danger">Can't read the event state: {err}</div>}
    {age !== null && age > 60 && <div className="ap-note danger">The game's state file is {dur(age)} old. The server may be down, or the treasure module is off (switch treasure_on).</div>}

    <div className="ap-sr">
      <SC label="Event" value={ev.on ? (ev.test ? "TEST" : "ON") : "OFF"} color={ev.on ? (ev.test ? "orange" : "green") : "red"}
        sub={ev.on ? `started ${fmtFull(ev.started)}` : "press Start below"} />
      <SC label="Time left" value={ev.on ? dur(left) : "-"} color="blue" sub={ev.on && ev.ends ? `ends ${fmtFull(ev.ends)}` : "4 h after the start"} />
      <SC label="Top prizes left" value={ev.prizes_left ?? "-"} color="purple" sub="for the 1st and 2nd team" />
      <SC label="Runners" value={ev.runners ?? 0} color="orange" sub={`${teams.length} team${teams.length === 1 ? "" : "s"}`} />
    </div>

    <div className="ap-2c">
      <FB title="EVENT">
        <div className="ap-note">
          Set the start spot first with <b>Set start here</b> in the in-game admin panel (Treasure tab).
          {ev.start ? <> Saved start: {ev.start.x}, {ev.start.y}, {ev.start.z}.</> : null}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <B c="green" disabled={busy || ev.on} onClick={() => start(false)}>Start event</B>
          <B c="orange" disabled={busy || ev.on} onClick={() => start(true)}>Start in test mode</B>
          <B c="red" disabled={busy || !ev.on} onClick={end}>End event</B>
        </div>
        <div className="ap-note info" style={{ marginTop: 14, marginBottom: 0 }}>
          Test mode: only admins can pick up a phone and only admins get hordes. Hints go to the admin channel.
        </div>
      </FB>
      <FB title="START PICTURE">
        <div className="ap-note">The bot posts this picture when the event starts. Wider map crops follow at +30 and +60 min by themselves.</div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={e => choosePic(e.target.files?.[0])} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <B c="ghost" onClick={() => fileRef.current?.click()}>Choose picture</B>
          <B c="gold" disabled={!pic || uploading} onClick={uploadPic}>{uploading ? "Uploading..." : "Upload"}</B>
          {pic && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{pic.name} ({Math.round(pic.size / 1024)} KB)</span>}
        </div>
        {picUrl && <img src={picUrl} alt="start picture preview" style={{ marginTop: 12, maxWidth: "100%", maxHeight: 220, border: "1px solid var(--border)" }} />}
      </FB>
    </div>

    <TW title="TEAMS" right={<span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--textdim)" }}>{age !== null ? `game snapshot ${dur(age)} ago` : ""} · refreshes every 3 s</span>}>
      {!teams.length ? <Empty text={ev.on ? "No team yet. Teams show up when someone picks up a phone." : "No teams. Start the event first."} /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="ap-t">
            <thead><tr><th>Team</th><th>Members</th><th>Step</th><th>In step</th><th>Fails</th><th>Game 2</th><th>Prize</th><th>Reset to</th></tr></thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "var(--mono)" }}>{t.id}{t.broken && <div style={{ color: "var(--red)", fontSize: 10 }}>BROKEN</div>}</td>
                  <td>
                    {(t.members || []).map(m => (
                      <div key={m.user} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, whiteSpace: "nowrap" }}>
                        <span title={m.here ? "in game" : "not in game"} style={{ width: 8, height: 8, borderRadius: "50%", background: m.here ? "var(--green)" : "var(--muted)" }} />
                        <span>{m.user}</span>
                        {m.bound !== undefined && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: m.bound ? "var(--green)" : "var(--textdim)" }}>{m.bound ? "phone paired" : "no phone yet"}</span>}
                        <B c="ghost" sm disabled={busy || m.bound === false} onClick={() => unbind(t, m.user)}>unbind</B>
                        <B c="red" sm disabled={busy} onClick={() => kick(t, m.user)}>kick</B>
                      </div>
                    ))}
                  </td>
                  <td><span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{STEP_NO[t.step] ?? "?"}. {t.step}</span><div style={{ fontSize: 11, color: "var(--textdim)" }}>{STEP_LABEL[t.step] || ""}</div></td>
                  <td style={{ fontFamily: "var(--mono)" }}>{t.since ? dur(now - t.since) : "-"}</td>
                  <td style={{ fontFamily: "var(--mono)", color: t.fails ? "var(--red)" : undefined }}>{t.fails ?? 0} / {t.fail_cap ?? 6}</td>
                  <td>{t.mg2 === "wiring" ? "Lab wiring" : t.mg2 === "vial" ? "Vial sort" : "-"}</td>
                  <td>{!t.prize ? "-" : t.prize === "consolation" ? "consolation" : "top prize"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select className="ap-sel" style={{ minWidth: 150 }} value={resetTo[t.id] || t.step} onChange={e => setResetTo({ ...resetTo, [t.id]: e.target.value })}>
                        {STEPS.map(([k, l]) => <option key={k} value={k}>{STEP_NO[k]}. {l}</option>)}
                      </select>
                      <B c="orange" sm disabled={busy} onClick={() => reset(t)}>reset</B>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TW>
    <SpotPictures toast={toast} spots={st?.spot_pics || []} teams={teams} reload={load} finalAt={st?.final_pic_at || 0} />

    <div className="ap-note">
      A team's real phones poll the website every 2 s, and the game answers in 2 to 6 s. Players see their codes and
      answers only in game; this page never shows tokens. The player page is stateofundeadpurge.site/p/ (opened from the QR in game).
    </div>
  </>);
}
