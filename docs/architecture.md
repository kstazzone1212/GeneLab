# GeneLab architecture

## Boundaries

The project is a Vite + TypeScript static site. The UI is currently a small shell rendered by `src/main.ts`; scientific models and services are kept separate so future phases can replace the shell without moving domain logic into the DOM.

- `src/models/`: typed scientific entities and provenance concepts.
- `src/services/`: contracts for data retrieval. Adapters should map external responses into local models.
- `src/data/`: centralized source metadata and, later, explicitly labelled demo fixtures.
- `src/i18n/`: complete UI dictionaries. Identifiers, symbols and nomenclature stay in scientific data, not translation strings.
- `src/styles/`: tokens, responsive layout, accessible focus states and reduced-motion support.

## Data and evidence

Every retrieved entity should carry source provenance. A source category describes origin, not truth: primary literature, curated database, reference database, computational prediction, AI explanation, and user-provided information are intentionally distinct. Any future confidence or limitation field must document its methodology; no universal score is assumed here.

External integrations belong behind service interfaces such as `GeneService`. In a static deployment, adapters may use public endpoints only after checking CORS, terms of use, rate limits and response stability. A small serverless proxy can be added later without coupling components to provider-specific URLs or exposing secrets.

Phase 2.5 connects `liveGeneService` to NCBI Gene E-utilities for search and normalized records, then uses Ensembl REST as best-effort enrichment on detail pages. `liveVariantService` uses ClinVar E-utilities by NCBI Gene ID for on-demand variant records. A live enrichment failure does not replace the NCBI record or invent fields; unavailable fields remain unavailable. The demo service is selected only through the explicit `demo=1` query parameter.

Phase 2.9 keeps search database-driven rather than maintaining a supported-gene list. NCBI Gene IDs are fetched directly with `esummary`; the selected gene detail is then enriched with the single-record XML `efetch` endpoint. Ensembl IDs use `/lookup/id/{id}`. Search results are ranked by exact identity, and detail loading requires an explicit symbol, alias, or stable identifier match. The shell uses a monotonically increasing request ID so stale asynchronous responses cannot overwrite the current route.

Variant records intentionally live outside Gene Details. A gene page links to `#/variants?gene={ncbiGeneId}`, where ClinVar records, filters and variant details are rendered by the Variant Explorer. This keeps gene identity/transcript/protein provenance separate from variant evidence and prevents the two datasets from being visually mixed.

The XML parser is browser-side because the deployment is static. If XML parsing fails or the full endpoint is temporarily unavailable, the already validated NCBI summary remains visible and unavailable fields stay unavailable; no other gene is substituted.

## Routing and deployment

Hash routing (`#/genes`) works with direct navigation on GitHub Pages without server rewrites. Vite uses a relative base (`./`) so the same build can be served from a repository subpath. The deployment workflow can later publish `dist/` using GitHub Actions.

## Future analysis and AI

Virtual Lab operations should be pure functions: receive validated user input, return a typed `AnalysisResult`, and report limitations. UI components should only format those results. The AI assistant should receive retrieved evidence and its provenance as context, then label its output as AI-generated explanation. It must never be used as a replacement for a source record or clinical interpretation.