import Link from "next/link";

// Site-wide notice (2026-09-24): Discord is blocked for many players in the Philippines; the DNS guide fixes it.
// Remove this component from app/layout.tsx once it's over.
export default function EmergencyBanner() {
  return (
    <div className="w-full bg-[#5a1f1a] border-b border-[#8a3a2b] text-[#ffe0d6] text-[0.8rem] px-4 py-2 text-center">
      <b>Can&apos;t open Discord?</b> It&apos;s blocked on some Philippine internet providers.{" "}
      <Link href="/discord-help" className="underline font-bold text-white hover:text-[#ffc24a]">
        2-minute fix here &rarr;
      </Link>
    </div>
  );
}
