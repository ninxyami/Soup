// Shared utility functions — extracted to avoid duplication across pages

export function repTier(pts: number): { label: string; color: string } {
  if (pts >= 200) return { label: "Legendary", color: "#c8a84b" };
  if (pts >= 100) return { label: "Honored",   color: "#4a7c59" };
  if (pts >= 50)  return { label: "Respected", color: "#4a6c8c" };
  if (pts >= 20)  return { label: "Known",     color: "#888"    };
  return           { label: "Neutral",         color: "#555"    };
}

export function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDuration(secs: number): string {
  if (!secs || secs <= 0) return "—";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
