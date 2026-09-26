import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Can't open Discord? · State of Undead Purge",
  description: "Discord blocked on your internet (Philippines)? Change your DNS in 2 minutes and it works again.",
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 sm:gap-4 mb-6">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[#4a7c59] text-white text-sm font-mono flex items-center justify-center">{n}</div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[0.95rem] mb-1">{title}</h3>
        <div className="text-[0.85rem] text-[#aaa] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono bg-[#1a1f1a] border border-[#2a332a] px-1.5 py-0.5 rounded text-[#cfe8c4]">{children}</code>;
}

function Shot({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="mt-3 max-w-full h-auto rounded border border-[#2a2a2a]" />;
}

export default function DiscordHelpPage() {
  return (
    <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Can&apos;t open Discord?</h1>
        <p className="text-[#777] text-[0.85rem]">
          Some players in the Philippines can&apos;t reach Discord right now. Our whitelist and website logins go
          through Discord, so here&apos;s how to get it back.
        </p>
        <div className="mt-6 border border-[#4a7c59] bg-[#0f1a12] rounded p-4 sm:p-5">
          <p className="text-[0.7rem] tracking-[0.2em] uppercase text-[#7ED957] mb-2">💚 A big thank you</p>
          <p className="text-[1.05rem] text-[#e8f5e0] mb-2">
            This whole guide comes from <b className="text-white">Four Eyes [ARC]</b>.
          </p>
          <p className="text-[0.85rem] text-[#b8ccb0] leading-relaxed">
            When Discord went dark for so many of us, Four Eyes found the fix, tested it, and took the time to walk us
            through every step with screenshots - so nobody gets left outside the server. That&apos;s exactly the kind of
            player that makes this community what it is. Thank you, Four Eyes. We owe you one. 🙏
          </p>
          <p className="text-[0.75rem] text-[#6f8f7c] mt-3">- Nin &amp; the SOUP team</p>
        </div>
      </section>

      <div className="divider" />

      <section>
        <h2>The fix: change your DNS</h2>
        <p>
          DNS is the &quot;phone book&quot; your internet uses to find websites. Switching it from your internet
          provider&apos;s to Cloudflare (<Code>1.1.1.1</Code>) and Google (<Code>8.8.8.8</Code>) gets Discord working
          again. It&apos;s free, takes about 2 minutes, and you can switch it back any time.
        </p>
      </section>

      <div className="divider" />

      <section>
        <h2>Windows (PC)</h2>
        <Step n={1} title="Open your network connections">
          Press <Code>Windows</Code> + <Code>R</Code>, type <Code>ncpa.cpl</Code> and press Enter.
          <Shot src="/assets/dns/step1-ncpa.png" alt="Typing ncpa.cpl" />
        </Step>
        <Step n={2} title="Open your connection's properties">
          Right-click the connection you use (Wi-Fi or Ethernet) and choose <b>Properties</b>. In the list, click{" "}
          <b>Internet Protocol Version 4 (TCP/IPv4)</b> once, then click <b>Properties</b>.
          <Shot src="/assets/dns/step2-properties.png" alt="Internet Protocol Version 4 selected, Properties button" />
        </Step>
        <Step n={3} title="Type the new DNS">
          Pick <b>Use the following DNS server addresses</b> and enter:
          <div className="mt-2 font-mono text-[0.85rem]">
            Preferred DNS server: <Code>1.1.1.1</Code>
            <br />
            Alternate DNS server: <Code>8.8.8.8</Code>
          </div>
          Leave &quot;Obtain an IP address automatically&quot; as it is. Click <b>OK</b>, then <b>OK</b> again.
          <Shot src="/assets/dns/step3-dns.png" alt="DNS set to 1.1.1.1 and 8.8.8.8" />
        </Step>
        <Step n={4} title="Restart Discord">
          Quit Discord completely (right-click its icon by the clock &rarr; Quit Discord) and open it again. Still not
          working? Open Command Prompt, type <Code>ipconfig /flushdns</Code> and press Enter - or just restart your PC.
        </Step>
      </section>

      <div className="divider" />

      <section>
        <h2>Android phone</h2>
        <Step n={1} title="Find Private DNS">
          Settings &rarr; <b>Network &amp; internet</b> (Samsung: <b>Connections &rarr; More connection settings</b>)
          &rarr; <b>Private DNS</b>.
        </Step>
        <Step n={2} title="Set it">
          Choose <b>Private DNS provider hostname</b>, type <Code>one.one.one.one</Code> and tap Save. Then close and
          reopen Discord.
        </Step>
      </section>

      <div className="divider" />

      <section>
        <h2>iPhone / iPad</h2>
        <Step n={1} title="Easiest: the free 1.1.1.1 app">
          Install Cloudflare&apos;s free <b>1.1.1.1</b> app from the App Store, open it and switch it on. Works on Wi-Fi
          and mobile data.
        </Step>
        <Step n={2} title="Or, Wi-Fi only">
          Settings &rarr; Wi-Fi &rarr; tap the <b>(i)</b> next to your network &rarr; <b>Configure DNS</b> &rarr;{" "}
          <b>Manual</b> &rarr; remove the old servers and add <Code>1.1.1.1</Code> and <Code>8.8.8.8</Code>.
        </Step>
      </section>

      <div className="divider" />

      <section>
        <h2>Mac</h2>
        <Step n={1} title="Set the DNS">
          System Settings &rarr; <b>Network</b> &rarr; your connection &rarr; <b>Details</b> &rarr; <b>DNS</b> &rarr; press{" "}
          <b>+</b> and add <Code>1.1.1.1</Code> and <Code>8.8.8.8</Code> &rarr; OK.
        </Step>
      </section>

      <div className="divider" />

      <section>
        <h2>DNS didn&apos;t work? Use a VPN</h2>
        <p>
          If changing the DNS didn&apos;t help (or you can&apos;t change it), a VPN gets around the block too. Install one,
          switch it on, then open Discord. These are free and safe:
        </p>
        <ul className="list-none pl-0 mt-3 flex flex-col gap-3 text-[0.85rem] text-[#aaa]">
          <li className="border border-[#2a332a] bg-[#0f1318] rounded p-3">
            <b className="text-[#e8f5e0]">Cloudflare 1.1.1.1 + WARP</b> - free, no account, PC and phone. Open the app
            and switch <b>WARP</b> on. The simplest one.{" "}
            <a href="https://one.one.one.one/" target="_blank" rel="noopener noreferrer" className="underline text-[#7ED957]">one.one.one.one</a>
          </li>
          <li className="border border-[#2a332a] bg-[#0f1318] rounded p-3">
            <b className="text-[#e8f5e0]">Proton VPN (Free plan)</b> - free forever, no data limit, trusted. Needs a
            free account.{" "}
            <a href="https://protonvpn.com/free-vpn" target="_blank" rel="noopener noreferrer" className="underline text-[#7ED957]">protonvpn.com</a>
          </li>
          <li className="border border-[#2a332a] bg-[#0f1318] rounded p-3">
            <b className="text-[#e8f5e0]">Psiphon</b> - free, made for getting around blocks. Shows some ads.{" "}
            <a href="https://psiphon.ca/" target="_blank" rel="noopener noreferrer" className="underline text-[#7ED957]">psiphon.ca</a>
          </li>
          <li className="border border-[#2a332a] bg-[#0f1318] rounded p-3">
            <b className="text-[#e8f5e0]">Paid, if you already have one</b> - Surfshark, NordVPN, ExpressVPN and the like all
            work fine.
          </li>
        </ul>
        <p className="text-[0.8rem] text-[#888] mt-3">
          Tips: only download VPNs from their official site or your app store, and stay away from random &quot;free VPN&quot;
          apps. A VPN can add lag in game, so you can switch it off while you play Project Zomboid - you only need it
          for Discord.
        </p>
      </section>

      <div className="divider" />

      <section>
        <h2>Still stuck?</h2>
        <p>
          Ask in the in-game chat - an admin or another player can help. To undo the change later, go back to the
          same screen and pick <b>Obtain DNS server address automatically</b> (Android: Private DNS &rarr;{" "}
          <b>Automatic</b>).
        </p>
        <p className="text-[#8aa88a] text-[0.85rem] mt-4">
          Got back in? Say thanks to <b>Four Eyes [ARC]</b> next time you see them in game. 💚
        </p>
      </section>
    </main>
  );
}
