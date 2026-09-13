import type { GeneService, LiteratureService, ProteinService, ServiceResult, VariantService } from './types';

const unavailable = <T>(): ServiceResult<T> => ({
  status: 'not-implemented',
  message: 'External scientific data services are planned for a future phase.',
});

export const geneService: GeneService = {
  async search() {
    return unavailable();
  },
  async getGene() {
    return unavailable();
  },
};

export const variantService: VariantService = {
  async getVariantsForGene() {
    return unavailable();
  },
  async getVariant() {
    return unavailable();
  },
};

export const proteinService: ProteinService = {
  async getProteinsForGene() {
    return unavailable();
  },
};

export const literatureService: LiteratureService = {
  async searchPublications() {
    return unavailable();
  },
};