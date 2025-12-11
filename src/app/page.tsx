"use client";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="logo">
          ALTBIM <span>Bygg &amp; BIM</span>
        </div>
        <a className="login-button" href="/app">
          Logg inn / Test BOB
        </a>
      </header>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-text">
            <div className="pill">
              <div className="pill-dot"></div>
              <span>Nyhet</span>
              <span>BOB kommer snart</span>
            </div>

            <h1>
              Din digitale
              <span>byggeplass- og BIM-assistent</span>
            </h1>

            <p className="lead">
              BOB er et smart verkt&oslash;y utviklet av <strong>Andreas Ludvigsen Theil</strong> i{" "}
              <strong>ALTBIM</strong> &ndash; laget for entrepren&oslash;rer, prosjekterende og byggherrer som vil ha mer
              kontroll, mindre rot og bedre flyt i prosjektene.
            </p>

            <p className="tagline">
              Fokus p&aring; effektiv prosjektstyring, logistikk, mengder og kvalitet &ndash; direkte koblet mot modell og
              prosjektdata.
            </p>

            <div className="actions">
              <div className="btn-primary">BOB er under utvikling</div>
              <div className="btn-ghost">F&oslash;rste versjon: Planlagt lansering 2026</div>
              <a className="btn-link" href="/app">
                Logg inn / G&aring; til BOB &rarr;
              </a>
            </div>

            <div className="meta">
              <strong>ALTBIM</strong> &bull; Utvikling av verkt&oslash;y for moderne byggeprosjekter
            </div>
          </div>

          <aside className="card">
            <div className="card-title">Hva blir BOB?</div>
            <ul className="list">
              <li>Digital assistent for mengder, kapplister og produksjonsgrunnlag.</li>
              <li>St&oslash;tte for logistikk, 3PL og smartere leveranser til byggeplass.</li>
              <li>Kravkontroll, kvalitetssikring og enkel oversikt over avvik.</li>
              <li>Prosjektrom med tilgangsstyring for entrepren&oslash;r, r&aring;dgiver og byggherre.</li>
            </ul>
            <p className="small-text">
              Denne siden er en forh&aring;ndsvisning av BOB-plattformen. Mer informasjon, demo og lanseringsplan kommer
              etter hvert som utviklingen g&aring;r fremover.
            </p>
            <p className="small-text">
              &Oslash;nsker du &aring; komme i kontakt om samarbeid, pilotprosjekter eller investering? Send en e-post til: 
              <a href="mailto:andtheil@gmail.com">andtheil@gmail.com</a>
            </p>
          </aside>
        </section>
      </main>

      <footer className="landing-footer">
        <span>BOB</span> er utviklet av Andreas Ludvigsen Theil &ndash; ALTBIM.
      </footer>

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          background: radial-gradient(circle at top, #1f2937 0, #020617 45%, #000 100%);
          color: #f9fafb;
          display: flex;
          flex-direction: column;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color-scheme: dark;
          padding: 0 1.5rem 1.5rem;
        }

        .landing-header {
          padding: 1.5rem 0 0.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
        }

        .logo {
          font-weight: 700;
          letter-spacing: 0.12em;
          font-size: 0.95rem;
          text-transform: uppercase;
        }

        .logo span {
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          border: 1px solid #4b5563;
          font-size: 0.75rem;
          margin-left: 0.5rem;
          opacity: 0.85;
        }

        .login-button {
          border: 1px solid #4b5563;
          color: #e5e7eb;
          background: rgba(15, 23, 42, 0.7);
          padding: 0.55rem 1.1rem;
          border-radius: 999px;
          text-decoration: none;
          font-size: 0.9rem;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .login-button:hover {
          transform: translateY(-1px);
          border-color: #22c55e;
        }

        .landing-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 0 3rem;
        }

        .hero {
          max-width: 1000px;
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
          gap: 3rem;
          align-items: center;
        }

        @media (max-width: 800px) {
          .hero {
            grid-template-columns: minmax(0, 1fr);
            text-align: left;
          }
          .landing-header {
            padding-inline: 0.5rem;
          }
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          border: 1px solid #4b5563;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #e5e7eb;
          margin-bottom: 1.25rem;
        }

        .pill-dot {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.7);
        }

        h1 {
          font-size: clamp(2.2rem, 5vw, 3.2rem);
          line-height: 1.1;
          margin: 0 0 1rem;
        }

        h1 span {
          display: block;
          background: linear-gradient(120deg, #22c55e, #38bdf8, #a855f7);
          -webkit-background-clip: text;
          color: transparent;
        }

        .lead {
          font-size: 1rem;
          line-height: 1.6;
          color: #d1d5db;
          margin-bottom: 1.5rem;
          max-width: 34rem;
        }

        .tagline {
          font-size: 0.9rem;
          color: #9ca3af;
          margin-bottom: 1.75rem;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 2rem;
        }

        .btn-primary,
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.7rem 1.3rem;
          border-radius: 999px;
          font-size: 0.9rem;
          border: 1px solid transparent;
          text-decoration: none;
          white-space: nowrap;
          color: #020617;
          font-weight: 600;
        }

        .btn-primary {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          box-shadow: 0 18px 40px rgba(22, 163, 74, 0.35);
        }

        .btn-ghost {
          border-color: #4b5563;
          color: #e5e7eb;
          background: rgba(15, 23, 42, 0.7);
          font-weight: 500;
        }

        .btn-link {
          color: #22c55e;
          text-decoration: none;
          font-weight: 600;
          padding: 0.7rem 1rem;
        }

        .btn-link:hover {
          text-decoration: underline;
        }

        .meta {
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #6b7280;
        }

        .meta strong {
          color: #e5e7eb;
          font-weight: 600;
        }

        .card {
          border-radius: 1.25rem;
          border: 1px solid rgba(55, 65, 81, 0.9);
          background: radial-gradient(circle at top, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.97));
          padding: 1.5rem 1.6rem;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.9);
        }

        .card-title {
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #9ca3af;
          margin-bottom: 1rem;
        }

        .list {
          list-style: none;
          padding: 0;
          margin: 0 0 1.5rem;
          display: grid;
          gap: 0.6rem;
          font-size: 0.9rem;
          color: #e5e7eb;
        }

        .list li::before {
          content: "•";
          margin-right: 0.4rem;
          color: #22c55e;
        }

        .small-text {
          font-size: 0.8rem;
          color: #9ca3af;
          line-height: 1.5;
        }

        .small-text a {
          color: #22c55e;
          text-decoration: none;
        }

        .small-text a:hover {
          text-decoration: underline;
        }

        .landing-footer {
          font-size: 0.75rem;
          color: #6b7280;
          text-align: center;
          margin-top: auto;
          padding-top: 0.75rem;
        }

        .landing-footer span {
          color: #e5e7eb;
        }
      `}</style>
    </div>
  );
}

