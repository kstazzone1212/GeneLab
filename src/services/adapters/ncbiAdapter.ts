import type { Gene, GenomicLocation, Protein, ScientificSource, Transcript } from '../../models/scientific';
import type { GeneService, ServiceResult } from '../types';

const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const HUMAN_TERM = 'Homo sapiens[Organism]';
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: ServiceResult<Gene[]> | ServiceResult<Gene> }>();

interface NCBISearchResponse { esearchresult?: { idlist?: string[] }; }
export interface NCBIGeneSummary {
  uid?: string; name?: string; nomenclaturesymbol?: string; nomenclaturename?: string; description?: string;
  summary?: string; chromosome?: string; maplocation?: string; otheraliases?: string; otherdesignations?: string;
  organism?: { scientificname?: string }; genomicinfo?: Array<{ chraccver?: string; chrstart?: number; chrstop?: number }>;
  locationhist?: Array<{ assemblyaccver?: string; chraccver?: string }>;
}
interface NCBISummaryResponse { result?: { uids?: string[]; [id: string]: NCBIGeneSummary | string[] | undefined }; }

const sourceFor = (id: string, retrievedAt: string): ScientificSource => ({
  id: `ncbi-gene-${id}`, name: 'NCBI Gene', category: 'reference-database', identifier: id,
  url: `https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(id)}`, retrievedAt,
});

const failure = <T>(errorCode: ServiceResult<T>['errorCode'], message: string): ServiceResult<T> => ({ status: 'error', errorCode, message, dataMode: 'live' });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const fetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (response.status === 429) throw new Error('RATE_LIMITED');
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json() as Promise<T>;
};

const fetchText = async (url: string, signal?: AbortSignal): Promise<string> => {
  const response = await fetch(url, { headers: { Accept: 'application/xml, text/xml' }, signal });
  if (response.status === 429) throw new Error('RATE_LIMITED');
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.text();
};

const withTimeout = async <T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 10000);
  try { return await request(controller.signal); } finally { globalThis.clearTimeout(timeout); }
};

const parseLocation = (summary: NCBIGeneSummary): GenomicLocation | undefined => {
  const info = summary.genomicinfo?.[0];
  if (!summary.chromosome || !info) return undefined;
  const start = info.chrstart;
  const end = info.chrstop;
  return { assembly: summary.locationhist?.[0]?.assemblyaccver ?? info.chraccver ?? 'NCBI assembly accession', chromosome: summary.chromosome, start: start !== undefined && end !== undefined ? Math.min(start, end) : start, end: start !== undefined && end !== undefined ? Math.max(start, end) : end, strand: start !== undefined && end !== undefined ? (start <= end ? '+' : '-') : undefined };
};

export const normalizeNcbiSummary = (summary: NCBIGeneSummary, retrievedAt: string): Gene => {
  const id = summary.uid ?? '';
  const symbol = summary.nomenclaturesymbol ?? summary.name ?? id;
  const name = summary.nomenclaturename ?? summary.description ?? symbol;
  return {
    id, symbol, name, organism: summary.organism?.scientificname ?? 'Homo sapiens', chromosome: summary.chromosome,
    location: parseLocation(summary), description: summary.summary, aliases: summary.otheraliases?.split(',').map((alias) => alias.trim()).filter(Boolean) ?? [],
    geneType: undefined, transcripts: [], proteins: [], externalIdentifiers: { NCBI: id }, sources: [sourceFor(id, retrievedAt)], designations: summary.otherdesignations?.split('|').filter(Boolean), genomicAccessions: summary.genomicinfo?.map((item) => item.chraccver).filter((item): item is string => Boolean(item)),
  };
};

const summarize = async (ids: string[], signal: AbortSignal): Promise<ServiceResult<Gene[]>> => {
  const retrievedAt = new Date().toISOString();
  const url = `${NCBI_BASE}/esummary.fcgi?db=gene&id=${ids.join(',')}&retmode=json`;
  const payload = await fetchJson<NCBISummaryResponse>(url, signal);
  if (!payload.result?.uids || !isRecord(payload.result)) return failure('malformed', 'NCBI Gene returned an unexpected response.');
  const genes = payload.result.uids.map((id) => payload.result?.[id]).filter((value): value is NCBIGeneSummary => isRecord(value)).map((value) => normalizeNcbiSummary(value, retrievedAt));
  return { status: 'ok', data: genes, dataMode: 'live' };
};

const rankMatches = (genes: Gene[], query: string): Gene[] => {
  const normalized = query.trim().toLocaleLowerCase();
  return [...genes].sort((left, right) => {
    const rank = (gene: Gene): number => {
      if (gene.symbol.toLocaleLowerCase() === normalized || gene.externalIdentifiers.NCBI?.toLocaleLowerCase() === normalized) return 0;
      if (gene.name.toLocaleLowerCase() === normalized) return 1;
      if (gene.aliases.some((alias) => alias.toLocaleLowerCase() === normalized)) return 2;
      return 3;
    };
    return rank(left) - rank(right);
  });
};

const xmlText = (root: ParentNode, selector: string): string | undefined => root.querySelector(selector)?.textContent?.trim() || undefined;
const directText = (root: Element, tagName: string): string | undefined => Array.from(root.children).find((child) => child.tagName === tagName)?.textContent?.trim() || undefined;
const directChild = (root: Element, tagName: string): Element | undefined => Array.from(root.children).find((child) => child.tagName === tagName);
const xmlDate = (root: ParentNode, selector: string): string | undefined => { const date = root.querySelector(selector); if (!date) return undefined; const year = xmlText(date, 'Date-std_year'); const month = xmlText(date, 'Date-std_month'); const day = xmlText(date, 'Date-std_day'); return year ? [year, month?.padStart(2, '0'), day?.padStart(2, '0')].filter(Boolean).join('-') : undefined; };

const externalSource = (database: string, identifier: string, retrievedAt: string): ScientificSource => {
  const urls: Record<string, string> = { Ensembl: `https://www.ensembl.org/id/${encodeURIComponent(identifier)}`, HGNC: `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${encodeURIComponent(identifier.replace(/^HGNC:/, ''))}` };
  return { id: `${database.toLocaleLowerCase()}-${identifier}`, name: database, category: 'curated-database', identifier, url: urls[database], retrievedAt };
};

export const normalizeNcbiGeneXml = (xml: string, fallback: Gene, retrievedAt: string): Gene => {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) return fallback;
  const locus = xmlText(document, 'Gene-ref_locus') ?? fallback.symbol;
  const name = xmlText(document, 'Gene-ref_desc') ?? fallback.name;
  const mapLocation = xmlText(document, 'Gene-ref_maploc');
  const aliases = Array.from(document.querySelectorAll('Gene-ref_syn_E')).map((item) => item.textContent?.trim()).filter((item): item is string => Boolean(item));
  const externalIdentifiers = { ...fallback.externalIdentifiers };
  document.querySelectorAll('Entrezgene_gene Dbtag').forEach((tag) => {
    const database = xmlText(tag, 'Dbtag_db');
    const identifier = xmlText(tag, 'Object-id_str');
    if (database && identifier && ['Ensembl', 'HGNC'].includes(database)) externalIdentifiers[database] = identifier;
  });
  const source = fallback.sources[0] ?? sourceFor(fallback.id, retrievedAt);
  const transcripts: Transcript[] = [];
  const proteins: Protein[] = [];
  const genomicAccessions: string[] = [];
  Array.from(document.getElementsByTagName('Gene-commentary')).forEach((commentary) => {
    const type = directChild(commentary, 'Gene-commentary_type')?.getAttribute('value');
    const accession = directText(commentary, 'Gene-commentary_accession');
    if (type === 'genomic' && accession) genomicAccessions.push(accession);
    if (type === 'mRNA' && accession) transcripts.push({ id: `${accession}.${directText(commentary, 'Gene-commentary_version') ?? ''}`.replace(/\.$/, ''), geneId: fallback.id, name: directText(commentary, 'Gene-commentary_label'), source, status: directText(commentary, 'Gene-commentary_heading') });
    const products = directChild(commentary, 'Gene-commentary_products');
    Array.from(products?.children ?? []).filter((product) => product.tagName === 'Gene-commentary').forEach((product) => {
      const productType = directChild(product, 'Gene-commentary_type')?.getAttribute('value');
      const proteinAccession = directText(product, 'Gene-commentary_accession');
      if (productType === 'peptide' && proteinAccession) proteins.push({ id: `${proteinAccession}.${directText(product, 'Gene-commentary_version') ?? ''}`.replace(/\.$/, ''), name: directText(product, 'Gene-commentary_label') ?? proteinAccession, geneId: fallback.id, organism: fallback.organism, sources: [source] });
    });
  });
  const sources = [...fallback.sources];
  Object.entries(externalIdentifiers).forEach(([database, identifier]) => {
    if (database !== 'NCBI' && !sources.some((item) => item.name === database && item.identifier === identifier)) sources.push(externalSource(database, identifier, retrievedAt));
  });
  const status = document.querySelector('Gene-track_status')?.getAttribute('value') ?? xmlText(document, 'Gene-track_status');
  return { ...fallback, symbol: locus, name, aliases: [...new Set([...fallback.aliases, ...aliases])], mapLocation, recordStatus: status ?? fallback.recordStatus, createdAt: xmlDate(document, 'Gene-track_create-date Date-std'), updatedAt: xmlDate(document, 'Gene-track_update-date Date-std'), designations: Array.from(document.querySelectorAll('Gene-ref_formal-name Gene-nomenclature_name')).map((item) => item.textContent?.trim()).filter((item): item is string => Boolean(item)), genomicAccessions: [...new Set(genomicAccessions)], transcripts: [...new Map(transcripts.map((item) => [item.id, item])).values()], proteins: [...new Map(proteins.map((item) => [item.id, item])).values()], externalIdentifiers, sources };
};

const enrichWithFullNcbiRecord = async (gene: Gene): Promise<Gene> => {
  try {
    const xml = await withTimeout((signal) => fetchText(`${NCBI_BASE}/efetch.fcgi?db=gene&id=${encodeURIComponent(gene.id)}&rettype=xml&retmode=xml`, signal));
    return normalizeNcbiGeneXml(xml, gene, new Date().toISOString());
  } catch {
    return gene;
  }
};

export const createNcbiGeneAdapter = (): GeneService => ({
  async search(query) {
    const normalized = query.trim();
    if (!normalized) return { status: 'ok', data: [], dataMode: 'live' };
    const key = `search:${normalized.toLocaleLowerCase()}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now() && 'data' in cached.value && Array.isArray(cached.value.data)) return cached.value as ServiceResult<Gene[]>;
    try {
      const result: ServiceResult<Gene[]> = await withTimeout(async (signal): Promise<ServiceResult<Gene[]>> => {
        const exactTerm = encodeURIComponent(`${normalized}[Gene Name] AND ${HUMAN_TERM}`);
        const exactPayload = await fetchJson<NCBISearchResponse>(`${NCBI_BASE}/esearch.fcgi?db=gene&term=${exactTerm}&retmode=json&retmax=20`, signal);
        let ids = exactPayload.esearchresult?.idlist;
        if (ids && !ids.length) {
          const broadTerm = encodeURIComponent(`${normalized}[All Fields] AND ${HUMAN_TERM}`);
          const broadPayload = await fetchJson<NCBISearchResponse>(`${NCBI_BASE}/esearch.fcgi?db=gene&term=${broadTerm}&retmode=json&retmax=20`, signal);
          ids = broadPayload.esearchresult?.idlist;
        }
        if (!ids) return failure('malformed', 'NCBI Gene returned an unexpected response.');
        if (!ids.length) return { status: 'ok', data: [], dataMode: 'live' };
        const summary = await summarize(ids, signal);
        return summary.status === 'ok' && summary.data ? { ...summary, data: rankMatches(summary.data, normalized) } : summary;
      });
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
      return result;
    } catch (error) {
      return failure(error instanceof Error && error.message === 'RATE_LIMITED' ? 'rate-limited' : 'network', 'NCBI Gene could not be reached.');
    }
  },
  async getGene(id) {
    const key = `gene:${id.toLocaleLowerCase()}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now() && 'data' in cached.value && !Array.isArray(cached.value.data)) return cached.value as ServiceResult<Gene>;
    try {
      const searchResult = /^\d+$/.test(id) ? await withTimeout((signal) => summarize([id], signal)) : await this.search(id);
      if (searchResult.status !== 'ok' || !searchResult.data?.length) return failure('not-found', 'No NCBI Gene record was found.');
      const normalizedId = id.toLocaleLowerCase();
      const gene = searchResult.data.find((item) => item.id === id)
        ?? searchResult.data.find((item) => item.symbol.toLocaleLowerCase() === normalizedId || item.aliases.some((alias) => alias.toLocaleLowerCase() === normalizedId));
      if (!gene) return failure('not-found', 'No NCBI Gene record was found.');
      const fullGene = await enrichWithFullNcbiRecord(gene);
      const result: ServiceResult<Gene> = { status: 'ok', data: fullGene, dataMode: 'live' };
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
      return result;
    } catch (error) {
      return failure(error instanceof Error && error.message === 'RATE_LIMITED' ? 'rate-limited' : 'network', 'NCBI Gene could not be reached.');
    }
  },
});