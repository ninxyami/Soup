// @ts-nocheck
"use client";
// app/performance/page.tsx: the staff health page (2026-11-01). Nin wanted ticks and everything else on the website instead
// of going through a server Claude. Behind the admin panel password like Live Ops and Security (PanelGate); the bot checks
// the Discord login and admin rights on every request (GET /api/admin/perf/*, bot perf_page_patch.py).

import PanelGate from "@/components/PanelGate";
import PerfApp from "@/components/perf/PerfApp";

export default function PerformancePage() {
  return (
    <PanelGate title="PERFORMANCE">
      <PerfApp />
    </PanelGate>
  );
}
