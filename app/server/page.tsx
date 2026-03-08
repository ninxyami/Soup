export default function ServerPage() {
  return (
    <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Server Information</h1>
        <p className="text-[#777] text-[0.85rem]">Everything you need to connect.</p>
      </section>

      <div className="divider" />

      <section>
        <h2>Connection</h2>
        <div className="flex flex-col gap-3 mt-3">
          {[
            { label: "IP", value: "15.235.166.58" },
            { label: "Port", value: "9000" },
            { label: "Password", value: "newdawn" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-6">
              <span className="text-[0.72rem] tracking-[0.1em] uppercase text-[#555] w-24 flex-shrink-0">{label}</span>
              <span className="text-[#e6e6e6] text-[0.95rem] font-mono">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      <section>
        <h2>Specs</h2>
        <div className="flex flex-col gap-3 mt-3">
          {[
            { label: "Players", value: "32 max" },
            { label: "RAM", value: "40 GB" },
            { label: "Region", value: "Singapore" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-6">
              <span className="text-[0.72rem] tracking-[0.1em] uppercase text-[#555] w-24 flex-shrink-0">{label}</span>
              <span className="text-[#e6e6e6] text-[0.95rem]">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      <section>
        <h2>Game Version</h2>
        <p>The server runs on <strong>B42.13.1</strong>. Switch your branch before joining:</p>
        <p className="text-[#777] text-[0.85rem]">
          Steam → Project Zomboid → Properties → Betas → select B42.13.1
        </p>
      </section>

      <div className="divider" />

      <section>
        <h2>Links</h2>
        <p><a href="https://discord.gg/NCBPqP5Q" target="_blank" rel="noopener noreferrer">Join our Discord</a></p>
        <p><a href="https://steamcommunity.com/sharedfiles/filedetails/?id=3653988013" target="_blank" rel="noopener noreferrer">Steam Workshop Collection</a></p>
        <p><a href="https://docs.google.com/spreadsheets/d/1kSo22-q_So3mZJ5hjYIH2oqQyOF-sIOacoV28HlQgFc/edit" target="_blank" rel="noopener noreferrer">Mods &amp; Server Settings</a></p>
      </section>

      <div className="divider" />

      <section>
        <h2>Quick Links</h2>
        <ul>
          <li><a href="/whitelist" className="text-[#4a7c59] no-underline hover:underline">Apply for whitelist →</a></li>
          <li><a href="https://discord.gg/stateofundeadpurge" target="_blank" rel="noopener noreferrer" className="text-[#4a7c59] no-underline hover:underline">Join our Discord →</a></li>
          <li><a href="/zombita" className="text-[#4a7c59] no-underline hover:underline">Contact admins via Zombita →</a></li>
          <li><a href="/philosophy" className="text-[#4a7c59] no-underline hover:underline">Read our server philosophy →</a></li>
        </ul>
      </section>
    </main>
  );
}
