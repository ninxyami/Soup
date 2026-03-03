"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

interface Mod {
  id: string;
  name: string;
  workshop_id: string;
  enabled: boolean;
  description?: string;
}

export default function AdminModsPage() {
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [announceType, setAnnounceType] = useState("info");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch(`${API}/api/admin/mods`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setMods(d.mods || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleMod = async (mod: Mod) => {
    const res = await fetch(`${API}/api/admin/mods/${mod.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !mod.enabled }),
    });
    if (res.ok) {
      setMods((prev) => prev.map((m) => m.id === mod.id ? { ...m, enabled: !m.enabled } : m));
      showToast(`${mod.name} ${!mod.enabled ? "enabled" : "disabled"}`);
    } else showToast("Failed", "error");
  };

  const sendAnnounce = async () => {
    if (!announce.trim()) return;
    const res = await fetch(`${API}/api/admin/announce`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: announce, type: announceType }),
    });
    if (res.ok) { showToast("Announcement sent!"); setAnnounce(""); }
    else showToast("Failed to send", "error");
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl tracking-widest text-[#c8cdd6]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>MODS &amp; ANNOUNCEMENTS</h1>
        <p className="font-mono text-sm text-dim mt-1">Manage active mods and broadcast messages</p>
      </div>

      {/* Announce */}
      <div className="border border-[#1e2530] bg-[#0f1318] p-6 mb-8">
        <h2 className="text-xl tracking-widest text-[#c8cdd6] mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>BROADCAST ANNOUNCEMENT</h2>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 flex-wrap">
            {[
              { id: "info", label: "Info", color: "border-info text-info" },
              { id: "warning", label: "Warning", color: "border-accent text-accent" },
              { id: "alert", label: "Alert", color: "border-danger text-danger" },
              { id: "event", label: "Event", color: "border-[#6a5acd] text-[#6a5acd]" },
            ].map((t) => (
              <button key={t.id} onClick={() => setAnnounceType(t.id)}
                className={`px-4 py-1 font-mono text-[0.7rem] uppercase tracking-widest border cursor-pointer bg-transparent transition-all ${announceType === t.id ? t.color : "border-[#1e2530] text-dim"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={announce}
            onChange={(e) => setAnnounce(e.target.value)}
            rows={3}
            placeholder="Announcement text..."
            className="bg-bg border border-[#1e2530] text-[#c8cdd6] px-4 py-3 font-mono text-sm outline-none focus:border-accent transition-colors resize-none"
          />
          <div>
            <button onClick={sendAnnounce} className="px-6 py-2 border border-accent text-accent font-mono text-xs uppercase tracking-widest hover:bg-accent hover:text-black transition-all cursor-pointer bg-transparent">
              Broadcast →
            </button>
          </div>
        </div>
      </div>

      {/* Mods list */}
      <div className="font-mono text-sm text-dim mb-3">{mods.length} mods installed · {mods.filter(m => m.enabled).length} active</div>
      {loading ? (
        <p className="font-mono text-dim text-sm">loading...</p>
      ) : (
        <div className="border border-[#1e2530]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1e2530]">
                <th className="admin-th">Mod Name</th>
                <th className="admin-th">Workshop ID</th>
                <th className="admin-th">Description</th>
                <th className="admin-th text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {mods.map((mod) => (
                <tr key={mod.id} className={`hover:bg-[#0f1318] transition-colors ${!mod.enabled ? "opacity-50" : ""}`}>
                  <td className="admin-td font-medium text-[#c8cdd6]">{mod.name}</td>
                  <td className="admin-td font-mono text-[0.72rem] text-dim">
                    <a href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshop_id}`} target="_blank" rel="noopener noreferrer" className="text-info no-underline hover:underline">
                      {mod.workshop_id}
                    </a>
                  </td>
                  <td className="admin-td text-dim text-[0.82rem]">{mod.description || "—"}</td>
                  <td className="admin-td text-right">
                    <button onClick={() => toggleMod(mod)}
                      className={`font-mono text-[0.7rem] px-3 py-1 border transition-all cursor-pointer bg-transparent ${mod.enabled ? "border-success text-success hover:bg-success hover:text-black" : "border-dim text-dim hover:border-[#c8cdd6] hover:text-[#c8cdd6]"}`}>
                      {mod.enabled ? "enabled" : "disabled"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`toast-slide px-5 py-3 font-mono text-xs border-l-[3px] bg-[#0f1318] ${toast.type === "success" ? "border-success text-success" : "border-danger text-danger"}`}>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
