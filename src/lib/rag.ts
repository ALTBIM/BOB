export type SourceDocument = {
  id: string;
  projectId: string;
  title: string;
  discipline: string;
  zone?: string;
  reference: string;
  text: string;
};

export type RetrievedSource = {
  id: string;
  projectId: string;
  title: string;
  reference: string;
  discipline: string;
  zone?: string;
  snippet: string;
  score: number;
};

type RetrieveOptions = {
  limit?: number;
  includeGeneralFallback?: boolean;
};

const projectDocuments: SourceDocument[] = [
  {
    id: "tek17-isolasjon",
    projectId: "project-1",
    title: "TEK17 Kapittel 13 - Varmeisolasjon",
    discipline: "Regulation",
    reference: "TEK17 §13-4",
    zone: "Fasade",
    text: "Yttervegger og tak skal prosjekteres slik at samlet varmetap tilfredsstiller rammekravene. Klimasone 3 krever normalt U-verdi yttervegg ≤ 0,18 W/m2K og vinduer ≤ 0,8 W/m2K. Prosjekterende skal dokumentere beregning, kontroll og eventuell avviksbehandling.",
  },
  {
    id: "svane-materialer",
    projectId: "project-1",
    title: "Svanemerket materialkrav",
    discipline: "Sustainability",
    reference: "Svanemerket 3.4",
    zone: "Materialvalg",
    text: "For prosjekter med Svanemerket skal trevirke være FSC eller PEFC, og det er krav om lavemitterende maling/lim. Dokumenter produktdatablad og leverandørsertifikater per leveranse.",
  },
  {
    id: "logistikk-plan",
    projectId: "project-2",
    title: "Leveranseplan kontorbygg",
    discipline: "Logistics",
    reference: "Logistikkplan v1.2",
    zone: "Lastesone B",
    text: "Leveranser til Lastesone B må forskyves utenom 07-09 og 15-17. Prefab dekker leveres etappevis per sone, og krever klarert kranløftplan før lossing. Alle biler skal ha forhåndsbooket slot i 3PL-portalen.",
  },
  {
    id: "ifc-struktur",
    projectId: "project-3",
    title: "BIM IFC – Bæresystem",
    discipline: "Structure",
    reference: "Model note v2",
    zone: "Kjerne",
    text: "IFC-modellen for bæresystem beskriver betongkjerner, stålbjelker og hulldekker. Kollisjoner registreres primært mellom stål og VVS i sjakter. Mengdegrunnlag for kjerne: 540 m3 betong, 42 tonn stål.",
  },
];

const generalDocuments: SourceDocument[] = [
  {
    id: "best-practice-mottak",
    projectId: "general",
    title: "Mottakskontroll prefab",
    discipline: "Quality",
    reference: "Best practice",
    text: "Ved mottak skal elementer kontrolleres mot følgeseddel, synlige skader, fukt og merking. Avvik loggføres og sperres før bruk. Bruk sjekkliste tilpasset prosjekt og leverandør.",
  },
  {
    id: "ifc-rutine",
    projectId: "general",
    title: "IFC prosesseringsrutine",
    discipline: "BIM",
    reference: "Rutine 01",
    text: "IFC-filer lagres per prosjekt og versjon. Metadata: prosjekt, modelltype, disiplin, sone/etasje, filstørrelse. Etter prosessering lagres materialuttrekk og objektantall i datastrukturen per modell.",
  },
];

function scoreText(text: string, query: string): number {
  const haystack = text.toLowerCase();
  const tokens = query.toLowerCase().split(/[^a-z0-9æøå]+/i).filter(Boolean);
  if (!tokens.length) return 0;

  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += 2;
    }
  });

  // Favor shorter, focused texts
  score += Math.max(0, 3 - Math.floor(text.length / 200));

  return score;
}

function trimSnippet(text: string, maxLength = 220): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

export function retrieveContext(
  projectId: string,
  query: string,
  options: RetrieveOptions = {}
): { sources: RetrievedSource[]; contextText: string } {
  const limit = options.limit ?? 4;
  const projectPool = projectDocuments.filter((doc) => doc.projectId === projectId);
  const pool = projectPool.length
    ? projectPool
    : options.includeGeneralFallback
    ? generalDocuments
    : [];

  const scored = pool
    .map((doc) => ({
      doc,
      score: scoreText(`${doc.title} ${doc.text}`, query),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const sources: RetrievedSource[] = scored.map(({ doc, score }) => ({
    id: doc.id,
    projectId: doc.projectId,
    title: doc.title,
    reference: doc.reference,
    discipline: doc.discipline,
    zone: doc.zone,
    snippet: trimSnippet(doc.text),
    score,
  }));

  const contextText = sources.length
    ? sources
        .map(
          (source, index) =>
            `[Kilde ${index + 1}] ${source.title} (${source.reference}) — ${source.snippet}`
        )
        .join("\n")
    : "Ingen prosjektkilder funnet.";

  return { sources, contextText };
}
