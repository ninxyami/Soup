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
        <h2>Still stuck?</h2>
        <p>
          Ask in the in-game chat - an admin or another player can help. To undo the change later, go back to the
          same screen and pick <b>Obtain DNS server address automatically</b> (Android: Private DNS &rarr;{" "}
          <b>Automatic</b>).
        </p>
        <p className="text-[#555] text-[0.75rem] mt-4">Guide by Four Eyes [ARC]. Thank you!</p>
      </section>
    </main>
  );
}
