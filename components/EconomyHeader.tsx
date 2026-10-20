import Link from "next/link";

// One header for the economy pages (Nin 10-20: "merge shop and market"): the nav has a single Shop link, and these
// tabs switch between the keepers' shops, the player marketplace and Zombita's intel.
const TABS = [
  { key: "shop", href: "/shop", label: "🏪 Shops", color: "#c8a84b" },
  { key: "market", href: "/marketplace", label: "🤝 Player market", color: "#4a8fc4" },
  { key: "intel", href: "/intel", label: "📰 Intel", color: "#c8a84b" },
] as const;

export default function EconomyHeader({ active }: { active: "shop" | "market" | "intel" }) {
  return (
    <header className="px-4 sm:px-8 py-3 border-b border-[#1e2530] bg-[#0f1318] sticky top-[49px] z-10">
      <div className="max-w-[1000px] mx-auto flex items-center gap-3 flex-wrap">
        <span className="font-display text-2xl tracking-[3px] text-accent mr-2" style={{ fontFamily: "'Bebas Neue',sans-serif", textShadow: "0 0 20px rgba(200,168,75,0.25)" }}>
          THE ECONOMY
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(t => {
            const on = t.key === active;
            return (
              <Link key={t.key} href={t.href}
                className="font-mono text-[0.65rem] px-3 py-1.5 border no-underline transition-all"
                style={on ? { borderColor: t.color, color: "#080a0c", background: t.color }
                          : { borderColor: "#1e2530", color: "#666" }}>
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
