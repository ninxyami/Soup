"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/constants";

type State = "loading" | "guest" | "done" | "register";

export default function WhitelistPage() {
  const [state, setState] = useState<State>("loading");
  const [ingameName, setIngameName] = useState("");
  const [doneName, setDoneName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (me) => {
        if (!me) { setState("guest"); return; }
        const ws = await fetch(`${API}/whitelist/status`, { credentials: "include" });
        if (ws.ok) {
          const wd = await ws.json();
          if (wd.whitelisted) { setDoneName(wd.ingame_name || ""); setState("done"); }
          else setState("register");
        } else setState("register");
      })
      .catch(() => setState("guest"));
  }, []);

  const submit = async () => {
    if (!ingameName.trim()) { setError("Please enter a username."); return; }
    setSubmitting(true); setError("");
    const res = await fetch(`${API}/whitelist/register`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingame_name: ingameName.trim() }),
    });
    const data = await res.json();
    if (res.ok) { setDoneName(ingameName.trim()); setState("done"); }
    else { setError(data.detail || "Something went wrong."); setSubmitting(false); }
  };

  return (
    <main className="max-w-[720px] mx-auto px-6 py-16">
      {state === "loading" && (
        <p className="text-[#777] text-[0.85rem]">Checking identity...</p>
      )}

      {state === "guest" && (
        <>
          <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Whitelist</h1>
          <p className="text-[#777] text-[0.85rem]">You must log in with Discord first.</p>
          <div className="divider" />
          <a href={`${API}/auth/discord/login`} className="btn-login">Login with Discord</a>
        </>
      )}

      {state === "done" && (
        <>
          <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">You&apos;re In</h1>
          <p className="text-[#777] text-[0.85rem] italic">&ldquo;yeah, I know you. you&apos;re <strong className="text-[#4a7c59]">{doneName}</strong>.&rdquo;</p>
          <div className="divider" />
          <p className="text-[#9a9a9a] text-sm">You&apos;re whitelisted and ready to join the server.</p>
          <p className="text-[#9a9a9a] text-sm">Connect using the details on the <a href="/server" className="text-[#4a7c59] hover:underline">Server</a> page.</p>
        </>
      )}

      {state === "register" && (
        <>
          <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Whitelist</h1>
          <p className="text-[#777] text-[0.85rem]">One step between you and the server.</p>

          <div className="divider" />

          <section>
            <h2>How it works</h2>
            <p>Enter the username you want to use in-game. Zombita will add you to the server whitelist instantly.</p>
            <p>Choose carefully — this will be your identity on the server.</p>
          </section>

          <div className="divider" />

          <section>
            <h2>Your in-game username</h2>
            <div className="mb-6">
              <input
                className="form-input"
                value={ingameName}
                onChange={(e) => setIngameName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="YourName"
                maxLength={24}
              />
              <p className="mt-1 text-[#777] text-[0.78rem]">Letters, numbers, underscores only. Max 24 characters.</p>
            </div>
            {error && <p className="text-[#c0392b] text-[0.85rem] mb-4">{error}</p>}
            <button onClick={submit} disabled={submitting} className="btn-submit">
              {submitting ? "Adding..." : "Request Whitelist"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
