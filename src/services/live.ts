import type { Gene } from '../models/scientific';
import { createEnsemblGeneAdapter } from './adapters/ensemblAdapter';
import { createNcbiGeneAdapter } from './adapters/ncbiAdapter';
import type { GeneService, ServiceResult } from './types';

const ncbi = createNcbiGeneAdapter();
const ensembl = createEnsemblGeneAdapter();

const asSearchFailure = (result: ServiceResult<Gene>): ServiceResult<Gene[]> => ({ status: result.status, errorCode: result.errorCode, message: result.message, dataMode: result.dataMode });

const enrich = async (gene: Gene): Promise<ServiceResult<Gene>> => {
  const result = await ensembl.enrich(gene);
  return result.status === 'ok' && result.data ? result : { status: 'ok', data: gene, dataMode: 'live' };
};

export const liveGeneService: GeneService = {
  async search(query) {
    const normalized = query.trim();
    if (/^ENSG\d+$/i.test(normalized)) {
      const result = await ensembl.getById(normalized.toUpperCase());
      return result.status === 'ok' && result.data ? { status: 'ok', data: [result.data], dataMode: 'live' } : asSearchFailure(result);
    }
    if (/^\d+$/.test(normalized)) {
      const result = await ncbi.getGene(normalized);
      return result.status === 'ok' && result.data ? { status: 'ok', data: [result.data], dataMode: 'live' } : asSearchFailure(result);
    }
    const result = await ncbi.search(query);
    if (result.status !== 'ok' || !result.data) return result;
    return { status: 'ok', data: result.data, dataMode: 'live' };
  },
  async getGene(id) {
    if (/^ENSG\d+$/i.test(id)) return ensembl.getById(id.toUpperCase());
    const result = await ncbi.getGene(id);
    if (result.status !== 'ok' || !result.data) return result;
    return enrich(result.data);
  },
};