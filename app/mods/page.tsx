export default function ModsPage() {
  return (
    <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <section>
        <h1 className="text-2xl tracking-[0.15em] uppercase mb-2">Mods</h1>
        <p className="text-[#777] text-[0.85rem]">Carefully selected. Purpose-driven. Stability first.</p>
      </section>

      <div className="divider" />

      <section>
        <h2>Why Mods Exist Here</h2>
        <p>Mods on State of Undead Purge are not used to bypass survival or accelerate progression.</p>
        <p>They exist to deepen systems, expand long-term gameplay, and support quality-of-life without trivializing the experience.</p>
      </section>

      <div className="divider" />

      <section>
        <h2>Stability &amp; Balance</h2>
        <p>All mods are tested before being added to the live server. Performance, compatibility, and balance are considered first.</p>
        <p>Experimental or unstable mods are avoided.</p>
      </section>

      <div className="divider" />

      <section>
        <h2>Full Mod List</h2>
        <p>
          The complete list of active mods and server settings is available on the{" "}
          <a href="https://docs.google.com/spreadsheets/d/1kSo22-q_So3mZJ5hjYIH2oqQyOF-sIOacoV28HlQgFc/edit" target="_blank" rel="noopener noreferrer">
            Mods &amp; Server Settings spreadsheet
          </a>
          .
        </p>
        <p>
          You can also subscribe to the full collection via the{" "}
          <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=3653988013" target="_blank" rel="noopener noreferrer">
            Steam Workshop Collection
          </a>
          .
        </p>
      </section>
    </main>
  );
}
