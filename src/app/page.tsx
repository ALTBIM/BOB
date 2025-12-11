import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <header className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-semibold text-lg">
            <Building2 className="h-6 w-6 text-blue-600" aria-hidden />
            <span>ALTBIM + BOB</span>
          </div>
          <Button asChild>
            <Link href="/app" className="flex items-center space-x-2">
              <span>Logg inn</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <section className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
              Neste generasjon bygg- og BIM-plattform
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                ALTBIM + BOB samler prosjektering, produksjon og forvaltning.
              </h1>
              <p className="text-lg text-slate-700 leading-relaxed">
                En strømlinjeformet plattform som kobler BIM-modeller direkte til produksjon,
                logistikk og kvalitetskontroll. Få bedre oversikt, raskere leveranser og tryggere prosjekter.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/app" className="flex items-center space-x-2">
                  <span>Logg inn i BOB</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <a
                href="#features"
                className="text-blue-700 hover:text-blue-800 font-semibold flex items-center space-x-2"
              >
                <span>Se hvordan det virker</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
          <div className="bg-white shadow-lg rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="rounded-lg bg-blue-50 p-3">
                <Workflow className="h-6 w-6 text-blue-700" aria-hidden />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Kontroll på hele livssyklusen</h2>
                <p className="text-slate-700">
                  Fra modellopplasting og mengdelister til produksjonsoppfølging og kvalitetskontroller – BOB gir teamet ett felles arbeidsrom.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="rounded-lg bg-emerald-50 p-3">
                <ShieldCheck className="h-6 w-6 text-emerald-700" aria-hidden />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Trygg tilgang</h2>
                <p className="text-slate-700">
                  Rollebaserte rettigheter og sikker innlogging sørger for at riktige personer har tilgang til riktige prosjekter.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="grid gap-6 md:grid-cols-3">
          {["Prosjektstyring", "BIM til produksjon", "Kvalitetskontroll"].map((feature) => (
            <div key={feature} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-2">{feature}</h3>
              <p className="text-slate-700 text-sm leading-relaxed">
                Optimaliser arbeidsflyten med delte prosjekter, oppgavestyring og innsikt i sanntid – alt bygget på ALTBIM + BOB.
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
