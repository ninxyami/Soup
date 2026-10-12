// @ts-nocheck
"use client";
// app/quests/page.tsx: all of quest control on its own page (Nin 2026-10-12), behind the admin panel password like
// Live Ops (PanelGate). The bot checks the Discord login and admin rights on every request.

import PanelGate from "@/components/PanelGate";
import QuestsApp from "@/components/quests/QuestsApp";

export default function QuestsPage() {
  return (
    <PanelGate title="QUESTS">
      <QuestsApp />
    </PanelGate>
  );
}
