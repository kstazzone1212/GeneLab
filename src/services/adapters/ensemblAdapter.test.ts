import { describe, expect, it, vi } from 'vitest';
import { createEnsemblGeneAdapter } from './ensemblAdapter';

describe('Ensembl gene adapter', () => {
  it('resolves an arbitrary human Ensembl gene ID', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      expect(String(input)).toContain('/lookup/id/ENSG00000141510');
      return new Response(JSON.stringify({
        id: 'ENSG00000141510', display_name: 'TP53', species: 'homo_sapiens', assembly_name: 'GRCh38',
        seq_region_name: '17', start: 7661779, end: 7687550, strand: -1, biotype: 'protein_coding',
        canonical_transcript: 'ENST00000269305', description: 'tumor protein p53 [Source:HGNC Symbol;Acc:HGNC:11998]',
      }), { status: 200 });
    });
    const result = await createEnsemblGeneAdapter().getById('ENSG00000141510');
    expect(result).toMatchObject({ status: 'ok', dataMode: 'live', data: { symbol: 'TP53', organism: 'Homo sapiens' } });
    expect(result.data?.externalIdentifiers.Ensembl).toBe('ENSG00000141510');
    expect(result.data?.sources[0]?.identifier).toBe('ENSG00000141510');
    fetchMock.mockRestore();
  });

  it('does not replace an unknown Ensembl ID with another gene', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    const result = await createEnsemblGeneAdapter().getById('ENSG00000000000');
    expect(result).toMatchObject({ status: 'error', errorCode: 'not-found', dataMode: 'live' });
    expect(result.data).toBeUndefined();
    fetchMock.mockRestore();
  });
});