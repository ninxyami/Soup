"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/constants";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");
  
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setStatus(me?.is_admin ? "ok" : "denied"))
      .catch(() => setStatus("denied"));
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080a0c" }}>
        <p className="font-mono text-sm tracking-widest" style={{ color: "#555" }}>VERIFYING IDENTITY...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: "#080a0c" }}>
        <div className="text-6xl">💀</div>
        <h1 className="text-5xl tracking-widest" style={{ fontFamily: "'Bebas Neue', sans-serif", color: "#e05555" }}>ACCESS DENIED</h1>
        <p className="font-mono text-sm" style={{ color: "#555" }}>you are not an admin.</p>
        <Link href="/" className="font-mono text-xs no-underline border px-4 py-2 transition-colors" style={{ borderColor: "#2a2a2a", color: "#777" }}>
          ← go back
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}