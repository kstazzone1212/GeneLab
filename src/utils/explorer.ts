import type { Gene, Variant } from '../models/scientific';

export interface VariantFilters {
  type?: string;
  consequence?: string;
  significance?: string;
  transcript?: string;
}

export const normalizeSearch = (value: string): string => value.trim().toLocaleLowerCase();

export const searchGenes = (genes: Gene[], query: string): Gene[] => {
  const normalized = normalizeSearch(query);
  if (!normalized) return genes;
  return genes.filter((gene) => [gene.symbol, gene.name, gene.id, ...gene.aliases].some((field) => normalizeSearch(field).includes(normalized)));
};

export const filterVariants = (variants: Variant[], filters: VariantFilters): Variant[] => variants.filter((variant) =>
  (!filters.type || variant.variantType === filters.type)
  && (!filters.consequence || variant.consequence === filters.consequence)
  && (!filters.significance || variant.clinicalSignificance === filters.significance)
  && (!filters.transcript || variant.transcriptChange?.includes(filters.transcript)));

export const sortVariantsByPosition = (variants: Variant[]): Variant[] => [...variants].sort((a, b) => (a.location?.start ?? Number.MAX_SAFE_INTEGER) - (b.location?.start ?? Number.MAX_SAFE_INTEGER));