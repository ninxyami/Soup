// @ts-nocheck
"use client";
// app/cards-admin/page.tsx: Zombita's Cards on its own page (Nin 2026-10-23: "make cards its own page rather than here, it
// needs multiple tabs and stuff ... add it just like QUESTS and OPS"). Behind the admin panel password like Live Ops
// (PanelGate). The bot checks the Discord login and admin rights on every request.

import PanelGate from "@/components/PanelGate";
import CardsAdminApp from "@/components/cardsadmin/CardsAdminApp";

export default function CardsAdminPage() {
  return (
    <PanelGate title="CARDS">
      <CardsAdminApp />
    </PanelGate>
  );
}
