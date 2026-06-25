export default function WhitelistPage() {
  return (
    <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Whitelist</h1>
      <p className="text-[#777] text-[0.85rem]">Whitelisting now happens entirely on Discord.</p>

      <div className="divider" />

      <section>
        <h2>How it works</h2>
        <p>
          Join the Discord server, then run the <code>/whitelist</code> command in any channel.
          Zombita will walk you through the rest and add you to the server whitelist.
        </p>
      </section>

      <div className="divider" />

      <a
        href="https://discord.gg/NCBPqP5Q"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-submit no-underline"
        style={{ display: "inline-block" }}
      >
        Join Discord
      </a>
    </main>
  );
}
