import { describe, expect, it, vi } from 'vitest';
import { createPubmedAdapter } from './pubmedAdapter';

describe('PubMed adapter', () => {
  it('maps public search summaries into sourced publications', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('esearch.fcgi')) return new Response(JSON.stringify({ esearchresult: { idlist: ['12345'] } }), { status: 200 });
      return new Response(JSON.stringify({ result: { uids: ['12345'], '12345': { uid: '12345', title: 'A retrieved scientific record', pubdate: '2024 Jan', fulljournalname: 'Example Journal', authors: [{ name: 'Author A' }], articleids: [{ idtype: 'doi', value: '10.1000/example' }] } } }), { status: 200 });
    });
    const result = await createPubmedAdapter().searchPublications('TNXB');
    expect(result).toMatchObject({ status: 'ok', dataMode: 'live', data: [{ id: '12345', title: 'A retrieved scientific record', source: { name: 'PubMed', identifier: '12345' } }] });
    fetchMock.mockRestore();
  });

  it('returns an empty live result when PubMed has no matches', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ esearchresult: { idlist: [] } }), { status: 200 }));
    const result = await createPubmedAdapter().searchPublications('no-match');
    expect(result).toMatchObject({ status: 'ok', data: [], dataMode: 'live' });
    fetchMock.mockRestore();
  });
});
