import { demoGenes, demoVariants } from '../data/demo';
import type { Gene, Protein, Variant } from '../models/scientific';
import { searchGenes, filterVariants, sortVariantsByPosition, type VariantFilters } from '../utils/explorer';
import type { GeneService, ProteinService, ServiceResult, VariantService } from './types';

const ok = <T>(data: T): ServiceResult<T> => ({ status: 'ok', data, dataMode: 'demo' });
const missing = <T>(message: string): ServiceResult<T> => ({ status: 'error', message, dataMode: 'demo' });

export const demoGeneService: GeneService = {
  async search(query) { return ok(searchGenes(demoGenes, query)); },
  async getGene(id) { const gene = demoGenes.find((item) => item.id === id); return gene ? ok(gene) : missing('No gene was found for this query.'); },
};

export const demoVariantService: VariantService = {
  async getVariantsForGene(geneId) { return ok(sortVariantsByPosition(demoVariants.filter((variant) => variant.geneId === geneId))); },
  async getVariant(id) { const variant = demoVariants.find((item) => item.id === id); return variant ? ok(variant) : missing('No variant record was found.'); },
};

export const demoProteinService: ProteinService = {
  async getProteinsForGene(geneId) { return ok((demoGenes.find((gene) => gene.id === geneId)?.proteins ?? []) as Protein[]); },
};

export const applyVariantFilters = (variants: Variant[], filters: VariantFilters): Variant[] => filterVariants(variants, filters);

export type DemoEntity = Gene | Variant;