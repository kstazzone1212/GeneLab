import type { Gene, GenomicLocation, ScientificSource, Transcript } from '../../models/scientific';
import type { ServiceResult } from '../types';

const baseUrl = 'https://rest.ensembl.org';

interface EnsemblLookup {
  id?: string; display_name?: string; description?: string; assembly_name?: string; seq_region_name?: string;
  start?: number; end?: number; strand?: 1 | -1; biotype?: string; canonical_transcript?: string;
}

const sourceFor = (id: string, retrievedAt: string): ScientificSource => ({
  id: `ensembl-${id}`, name: 'Ensembl', category: 'reference-database', identifier: id,
  url: `https://www.ensembl.org/id/${encodeURIComponent(id)}`, retrievedAt,
});

const failure = <T>(errorCode: ServiceResult<T>['errorCode'], message: string): ServiceResult<T> => ({ status: 'error', errorCode, message, dataMode: 'live' });

const lookup = async (path: string): Promise<ServiceResult<EnsemblLookup>> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (response.status === 404) return failure('not-found', 'No Ensembl gene record was found.');
    if (!response.ok) return failure(response.status === 429 ? 'rate-limited' : 'unavailable', 'Ensembl could not be reached.');
    const record = await response.json() as EnsemblLookup;
    return record.id && record.display_name ? { status: 'ok', data: record, dataMode: 'live' } : failure('malformed', 'Ensembl returned an unexpected response.');
  } catch {
    return failure('network', 'Ensembl could not be reached.');
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const normalize = (record: EnsemblLookup, retrievedAt: string, fallbackGene?: Gene): Gene => {
  const id = record.id ?? fallbackGene?.id ?? '';
  const symbol = record.display_name ?? fallbackGene?.symbol ?? id;
  const location: GenomicLocation | undefined = record.seq_region_name && record.start !== undefined && record.end !== undefined ? { assembly: record.assembly_name ?? 'Ensembl assembly', chromosome: record.seq_region_name, start: record.start, end: record.end, strand: record.strand === 1 ? '+' : record.strand === -1 ? '-' : undefined } : fallbackGene?.location;
  const source = sourceFor(id, retrievedAt);
  const transcript: Transcript | undefined = record.canonical_transcript ? { id: record.canonical_transcript, geneId: fallbackGene?.id ?? id, source, status: 'canonical transcript reported by Ensembl' } : undefined;
  const name = record.description?.split(' [Source:')[0] ?? fallbackGene?.name ?? symbol;
  return {
    ...(fallbackGene ?? { id, symbol, name, organism: 'Homo sapiens', aliases: [], transcripts: [], proteins: [], externalIdentifiers: {}, sources: [] }),
    id: fallbackGene?.id ?? id, symbol, name, organism: 'Homo sapiens', location,
    description: fallbackGene?.description ?? record.description, geneType: record.biotype ?? fallbackGene?.geneType,
    transcripts: transcript ? [transcript] : fallbackGene?.transcripts ?? [], proteins: fallbackGene?.proteins ?? [],
    externalIdentifiers: { ...(fallbackGene?.externalIdentifiers ?? {}), Ensembl: id }, sources: [...(fallbackGene?.sources ?? []), source],
  };
};

export const createEnsemblGeneAdapter = (): {
  enrich(gene: Gene): Promise<ServiceResult<Gene>>;
  getById(id: string): Promise<ServiceResult<Gene>>;
} => ({
  async enrich(gene) {
    const result = await lookup(`/lookup/symbol/homo_sapiens/${encodeURIComponent(gene.symbol)}?content-type=application/json`);
    if (result.status !== 'ok' || !result.data) return result.status === 'error' && result.errorCode === 'not-found' ? { status: 'ok', data: gene, dataMode: 'live' } : result as ServiceResult<Gene>;
    return { status: 'ok', data: normalize(result.data, new Date().toISOString(), gene), dataMode: 'live' };
  },
  async getById(id) {
    const result = await lookup(`/lookup/id/${encodeURIComponent(id)}?content-type=application/json`);
    if (result.status !== 'ok' || !result.data) return result as ServiceResult<Gene>;
    return { status: 'ok', data: normalize(result.data, new Date().toISOString()), dataMode: 'live' };
  },
});
