import { describe, expect, it, vi } from 'vitest';
import { createNcbiGeneAdapter, normalizeNcbiSummary } from './ncbiAdapter';
import en from '../../i18n/en.json';
import es from '../../i18n/es.json';

describe('NCBI Gene adapter', () => {
  it('normalizes a real-shaped summary with provenance and assembly', () => {
    const gene = normalizeNcbiSummary({
      uid: '672', nomenclaturesymbol: 'BRCA1', nomenclaturename: 'BRCA1 DNA repair associated', chromosome: '17',
      otheraliases: 'BRCAI, BRCC1', summary: 'Description from NCBI Gene.', organism: { scientificname: 'Homo sapiens' },
      genomicinfo: [{ chraccver: 'NC_000017.11', chrstart: 43170326, chrstop: 43044294 }], locationhist: [{ assemblyaccver: 'GCF_000001405.40' }],
    }, '2026-09-13T00:00:00.000Z');
    expect(gene.symbol).toBe('BRCA1');
    expect(gene.location).toMatchObject({ assembly: 'GCF_000001405.40', start: 43044294, end: 43170326, strand: '-' });
    expect(gene.sources[0]).toMatchObject({ name: 'NCBI Gene', identifier: '672', retrievedAt: '2026-09-13T00:00:00.000Z' });
  });

  it('transforms mocked NCBI search and summary responses into live records', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('esearch.fcgi')) return new Response(JSON.stringify({ esearchresult: { idlist: ['672'] } }), { status: 200 });
      return new Response(JSON.stringify({ result: { uids: ['672'], '672': { uid: '672', name: 'BRCA1', nomenclaturesymbol: 'BRCA1', nomenclaturename: 'BRCA1 DNA repair associated', organism: { scientificname: 'Homo sapiens' } } } }), { status: 200 });
    });
    const result = await createNcbiGeneAdapter().search('BRCA1-test');
    expect(result.status).toBe('ok');
    expect(result.dataMode).toBe('live');
    expect(result.data?.[0]?.externalIdentifiers.NCBI).toBe('672');
    fetchMock.mockRestore();
  });

  it.each([
    ['TNXB', '7148'], ['COL1A1', '1277'], ['BRCA1', '672'], ['TP53', '7157'], ['FBN1', '2200'], ['CFTR', '1080'], ['VEGFA', '7422'],
  ])('loads %s by its stable NCBI ID without falling back to another result', async (symbol, id) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      expect(url).toContain('esummary.fcgi');
      return new Response(JSON.stringify({ result: { uids: [id], [id]: { uid: id, name: symbol, nomenclaturesymbol: symbol, nomenclaturename: `${symbol} official gene name`, organism: { scientificname: 'Homo sapiens' } } } }), { status: 200 });
    });
    const result = await createNcbiGeneAdapter().getGene(id);
    expect(result.status).toBe('ok');
    expect(result.data?.id).toBe(id);
    expect(result.data?.symbol).toBe(symbol);
    fetchMock.mockRestore();
  });

  it('resolves a direct symbol route only from an explicit symbol match', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('esearch.fcgi')) return new Response(JSON.stringify({ esearchresult: { idlist: ['7148'] } }), { status: 200 });
      return new Response(JSON.stringify({ result: { uids: ['7148'], '7148': { uid: '7148', name: 'TNXB', nomenclaturesymbol: 'TNXB', nomenclaturename: 'Tenascin XB', organism: { scientificname: 'Homo sapiens' } } } }), { status: 200 });
    });
    const result = await createNcbiGeneAdapter().getGene('TNXB');
    expect(result.data?.symbol).toBe('TNXB');
    fetchMock.mockRestore();
  });

  it('returns a normalized network error instead of exposing fetch details', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('socket detail should not reach UI'));
    const result = await createNcbiGeneAdapter().search('network-test');
    expect(result).toMatchObject({ status: 'error', errorCode: 'network', dataMode: 'live' });
    expect(result.message).toBe('NCBI Gene could not be reached.');
    fetchMock.mockRestore();
  });

  it('caches repeated searches and preserves empty live results', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ esearchresult: { idlist: [] } }), { status: 200 }));
    const adapter = createNcbiGeneAdapter();
    const first = await adapter.search('empty-cache-test');
    const second = await adapter.search('empty-cache-test');
    expect(first).toMatchObject({ status: 'ok', data: [], dataMode: 'live' });
    expect(second).toMatchObject({ status: 'ok', data: [], dataMode: 'live' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it('keeps live explorer messages bilingual', () => {
    for (const key of ['explorer.liveData', 'explorer.fetchError', 'explorer.notFound', 'explorer.geneType']) {
      expect(en[key as keyof typeof en]).toBeTruthy();
      expect(es[key as keyof typeof es]).toBeTruthy();
    }
  });
});