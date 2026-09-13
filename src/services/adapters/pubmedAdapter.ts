import type { Publication, ScientificSource } from '../../models/scientific';
import type { LiteratureService, ServiceResult } from '../types';

const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
interface SearchResponse { esearchresult?: { idlist?: string[] }; }
interface ArticleSummary { uid?: string; title?: string; fulljournalname?: string; pubdate?: string; authors?: Array<{ name?: string }>; articleids?: Array<{ idtype?: string; value?: string }>; }
interface SummaryResponse { result?: { uids?: string[]; [id: string]: ArticleSummary | string[] | undefined }; }
const failure = <T>(message: string): ServiceResult<T> => ({ status: 'error', errorCode: 'network', message, dataMode: 'live' });
const sourceFor = (id: string, retrievedAt: string): ScientificSource => ({ id: `pubmed-${id}`, name: 'PubMed', category: 'primary-literature', identifier: id, url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(id)}/`, retrievedAt });

export const createPubmedAdapter = (): LiteratureService => ({
  async searchPublications(query: string) {
    if (!query.trim()) return { status: 'ok', data: [], dataMode: 'live' };
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 10000);
    try {
      const searchResponse = await fetch(`${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=20&sort=relevance`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!searchResponse.ok) return failure('PubMed could not be reached.');
      const search = await searchResponse.json() as SearchResponse;
      const ids = search.esearchresult?.idlist ?? [];
      if (!ids.length) return { status: 'ok', data: [], dataMode: 'live' };
      const summaryResponse = await fetch(`${baseUrl}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!summaryResponse.ok) return failure('PubMed could not be reached.');
      const payload = await summaryResponse.json() as SummaryResponse;
      if (!payload.result?.uids) return failure('PubMed returned an unexpected response.');
      const retrievedAt = new Date().toISOString();
      const data: Publication[] = payload.result.uids.map((id) => payload.result?.[id]).filter((item): item is ArticleSummary => typeof item === 'object' && item !== null).map((item) => ({ id: item.uid ?? '', title: item.title ?? 'Untitled record', authors: item.authors?.map((author) => author.name ?? '').filter(Boolean) ?? [], journal: item.fulljournalname, year: item.pubdate ? Number(item.pubdate.slice(0, 4)) || undefined : undefined, identifiers: Object.fromEntries((item.articleids ?? []).filter((article) => article.idtype && article.value).map((article) => [article.idtype as string, article.value as string])), url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(item.uid ?? '')}/`, source: sourceFor(item.uid ?? '', retrievedAt) }));
      return { status: 'ok', data, dataMode: 'live' };
    } catch {
      return failure('PubMed could not be reached.');
    } finally {
      globalThis.clearTimeout(timeout);
    }
  },
});
