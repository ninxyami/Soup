// @ts-nocheck
"use client";
// app/security/page.tsx: Zombita's Security on its own page (2026-10-16; it was a tab in Live Ops > Zombita). Behind
// the admin panel password like Live Ops (PanelGate). The bot checks the Discord login and admin rights on every request.

import PanelGate from "@/components/PanelGate";
import SecurityApp from "@/components/security/SecurityApp";

export default function SecurityPage() {
  return (
    <PanelGate title="SECURITY">
      <SecurityApp />
    </PanelGate>
  );
}
