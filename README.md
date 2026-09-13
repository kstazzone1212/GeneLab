# GeneLab

**Bilingual molecular genetics exploration and education platform.**

GeneLab is an open foundation for connecting genes, variants, proteins, phenotypes, scientific literature and computational molecular analysis. It is designed for education and research support, with provenance and limitations visible from the start.

> GeneLab is not a clinical diagnostic tool. It does not replace genetic counseling, laboratory validation, professional bioinformatics pipelines or peer-reviewed scientific judgment.

## Status

### Implemented in Phase 1

- Vite + TypeScript static application shell.
- Hash-based navigation compatible with direct GitHub Pages URLs.
- Responsive scientific visual system with light/dark theme toggle.
- English/Spanish UI dictionaries and language switching without reloading the page.
- Typed models for genes, variants, proteins, phenotypes, publications, sequences, analyses and sources.
- Service interfaces for future gene, variant and literature providers.
- Explicitly unavailable service adapters; no fabricated records or API responses.
- Source categories and provenance fields for evidence-aware features.
- Accessibility foundations: semantic landmarks, keyboard focus, labels and reduced-motion support.

### Implemented in Phase 2

- Gene search by symbol, name, alias and identifier through an application service.
- Reusable gene details view with identity, assembly-aware location, function, transcripts and proteins.
- Variant explorer associated with a selected gene, including type and molecular-consequence filters.
- Variant detail view with HGVS fields, genomic context, clinical interpretation fields and uncertainty notes.
- Reusable evidence panels with source category, identifier, official links and limitations.
- Loading, error and empty states that never silently substitute fake scientific records.
- Deep links such as `#/gene/DEMO-GENE-ALPHA` and `#/variant/DEMO-VAR-001`.
- Four unit tests for search normalization, gene search, variant filtering and position sorting.

### Implemented in Phase 2.5

- Live human gene search through NCBI Gene E-utilities (`esearch.fcgi` and `esummary.fcgi`).
- NCBI Gene normalization into the shared `Gene` model, including symbol, name, aliases, organism, chromosome, coordinates, assembly accession and source provenance.
- Ensembl REST lookup enrichment on gene detail pages for Ensembl ID, assembly-aware coordinates, gene biotype and canonical transcript when available.
- ClinVar variant retrieval by NCBI Gene ID, including HGVS, assembly, molecular consequence, clinical significance, review status and provenance.
- Separate Variant Explorer route (`#/variants?gene=...`) so gene details remain focused on identity, genomics, function, transcripts, proteins and sources.
- Responsive transcript and protein grids instead of a single long metadata column.

### Completed site sections

- PubMed literature search with live record summaries and official links.
- Virtual Molecular Lab with local DNA/RNA/protein length, GC percentage, transcription, reverse-complement and translation calculations.
- Evidence Research Assistant that retrieves a live gene record and organizes sourced fields without inventing interpretations.
- About/Methodology and Scientific Sources pages with safety, provenance and limitation disclosures.
- Five-minute in-memory request cache and ten-second request timeout.
- Normalized network, rate-limit, malformed-response and not-found errors with bilingual UI messages.
- Live/demo distinction preserved in banners and service results. Live data is the default.
- Mocked adapter tests for successful transformation, provenance, invalid responses and network failure.

### Implemented in Phase 2.9

- Generic human gene search with no local allowlist or seven-gene restriction.
- Exact-match ranking for official symbols, NCBI IDs, names and aliases.
- Dynamic Ensembl Gene ID lookup (`ENSG...`) through Ensembl REST.
- Direct NCBI ID detail retrieval, preventing a requested ID from being replaced by the first search result.
- Stale-request protection so an older search cannot overwrite a newer route result.
- Explicit identifier-aware not-found messages and human-only query scope.

### Planned

Europe PMC, UniProt, HGNC and additional provider adapters remain optional integrations. The current assistant is deliberately evidence-based rather than a generative AI service: no private AI credentials are exposed in the static frontend and no unsupported explanations are generated.

## Technology

GeneLab uses Vite and TypeScript without a UI framework. This keeps the initial dependency surface small, gives the domain models strict checking, and produces ordinary static assets for GitHub Pages. A framework can be introduced later only if the UI complexity justifies it.

## Local development

```bash
npm install
npm run dev
```

The production check is:

```bash
npm run build
```

It runs TypeScript in strict mode and generates the deployable `dist/` directory. `npm run preview` serves that build locally.

## Architecture

```text
src/
	data/       Source definitions and future labelled fixtures
	i18n/       English and Spanish dictionaries
	models/     Scientific domain interfaces and evidence model
	services/   Provider-independent service contracts and adapters
	styles/     Theme tokens, responsive and accessibility styles
	main.ts     Hash router and current application shell
docs/         Architecture notes and future integration boundaries
```

See [docs/architecture.md](docs/architecture.md) for data boundaries, deployment and future AI/lab integration rules.

## Scientific data sources and demo mode

The current explorer uses live NCBI Gene data by default. The small synthetic dataset in `src/data/demo.ts` remains available only when the URL includes `?demo=1`, for example `#/genes?q=DEMO1&demo=1`. Every demo record is labelled **DEMO DATA - NOT LIVE SCIENTIFIC DATABASE DATA** and is intended only to exercise navigation and UI states. It is not authoritative and must not be used for scientific conclusions.

The source catalog and adapter boundaries are prepared for NCBI Gene, ClinVar, dbSNP, Ensembl, UniProt, HGNC, PubMed and Europe PMC. Live connections currently include NCBI Gene, Ensembl and ClinVar. The frontend contains no API keys. If a provider cannot be used safely from a static site because of authentication, CORS, terms or rate limits, a separately secured serverless proxy is the appropriate next boundary.

### Live endpoints

- NCBI Gene search: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`
- NCBI Gene records: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`
- NCBI Gene full detail: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=gene&rettype=xml`
- ClinVar search and records: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar` and `esummary.fcgi?db=clinvar`
- Ensembl gene lookup: `https://rest.ensembl.org/lookup/symbol/homo_sapiens/{symbol}`

The public endpoints currently respond with permissive CORS headers suitable for this static client. NCBI advertises a limit of approximately three requests per second without an API key; the client therefore caches requests for five minutes and performs the full XML request only for the selected gene detail. The detail parser exposes NCBI status, dates, map location, designations, genomic accessions, transcripts, protein products and cross-references when the record supplies them. A future production deployment may need a serverless proxy, throttling and provider-specific usage review.

GeneLab queries connected public databases dynamically; it does not claim to contain every human gene locally. Coverage depends on the records returned by NCBI Gene, Ensembl and ClinVar at request time. NCBI Gene is the primary symbol/name/alias search source, Ensembl supports detail enrichment and `ENSG...` identifier lookup, and ClinVar provides on-demand variant records for the selected NCBI Gene ID.

## Evidence and limitations

Displayed source metadata distinguishes reference databases, curated databases, primary literature, computational predictions, AI explanations and user-provided information. Clinical classifications are intentionally optional and are never collapsed into a universal confidence score. Missing records mean only that the selected demo/source returned no record; they do not imply biological absence.

The demo records do not include clinical significance or real allele frequencies. A future live adapter must preserve conflicting submissions, review status, submitters, retrieval dates and genome assembly rather than simplifying them. Automated interpretation will remain limited and must not be presented as diagnosis.

## Bilingual and scientific naming policy

UI copy lives in `src/i18n/en.json` and `src/i18n/es.json`. Scientific symbols, identifiers and standard nomenclature remain data values and are never translated as ordinary prose. Adding a language should add a dictionary and keep the same translation keys.

## Roadmap

1. **Phase 1 - Architecture and foundation:** completed; shell, contracts, provenance, i18n and deployment-ready structure.
2. **Phase 2 - Gene and Variant Explorer:** completed with synthetic demo mode and provider adapter boundaries.
3. **Phase 2.5 - Live Gene Explorer:** completed for NCBI Gene search/detail and Ensembl detail enrichment.
4. **Phase 2.9 - Universal human gene search:** completed with arbitrary database-driven lookup and identity validation.
5. **Phase 3 - Site completion:** completed for the current scope with PubMed, Variant Explorer, Virtual Molecular Lab, evidence assistant, methodology and sources.
6. **Remaining polish:** accessibility audit, broader provider integrations, performance review and Devpost preparation.

## GitHub Pages

The Vite base is relative, which supports repository subpaths. A future GitHub Actions workflow should run `npm ci`, `npm run build`, and publish `dist/`. Hash routing is intentional because GitHub Pages does not provide SPA rewrite rules by default.

## Manual configuration

No secrets or external API credentials are needed for Phase 2.5. Before connecting additional providers, review each service's public API policy and decide whether a backend/serverless proxy is required. The repository owner will also need to enable GitHub Pages from the Actions deployment source when a workflow is added.