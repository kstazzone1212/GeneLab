import type { Gene, Publication, Protein, Variant } from '../models/scientific';

export interface ServiceResult<T> {
  status: 'ok' | 'not-implemented' | 'error';
  data?: T;
  message?: string;
  dataMode?: 'demo' | 'live';
  errorCode?: 'network' | 'not-found' | 'rate-limited' | 'malformed' | 'unavailable';
}

export interface GeneService {
  search(query: string): Promise<ServiceResult<Gene[]>>;
  getGene(id: string): Promise<ServiceResult<Gene>>;
}

export interface VariantService {
  getVariantsForGene(geneId: string): Promise<ServiceResult<Variant[]>>;
  getVariant(id: string): Promise<ServiceResult<Variant>>;
}

export interface ProteinService {
  getProteinsForGene(geneId: string): Promise<ServiceResult<Protein[]>>;
}

export interface LiteratureService {
  searchPublications(query: string): Promise<ServiceResult<Publication[]>>;
}