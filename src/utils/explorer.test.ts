import { describe, expect, it } from 'vitest';
import { demoGenes, demoVariants } from '../data/demo';
import { filterVariants, normalizeSearch, searchGenes, sortVariantsByPosition } from './explorer';

describe('explorer data transformations', () => {
  it('normalizes user search input', () => {
    expect(normalizeSearch('  DEMO1 ')).toBe('demo1');
  });

  it('searches symbols, names, aliases, and identifiers', () => {
    expect(searchGenes(demoGenes, 'example_alpha')).toHaveLength(1);
    expect(searchGenes(demoGenes, 'DEMO-GENE-BETA')[0]?.symbol).toBe('DEMO2');
    expect(searchGenes(demoGenes, 'unknown')).toHaveLength(0);
  });

  it('filters variants without inventing missing classifications', () => {
    expect(filterVariants(demoVariants, { type: 'SNV' })).toHaveLength(1);
    expect(filterVariants(demoVariants, { consequence: 'frameshift' })[0]?.id).toBe('DEMO-VAR-002');
    expect(filterVariants(demoVariants, { significance: 'Pathogenic' })).toHaveLength(0);
  });

  it('sorts variants by available genomic position', () => {
    expect(sortVariantsByPosition([...demoVariants]).map((variant) => variant.id)).toEqual(['DEMO-VAR-001', 'DEMO-VAR-002']);
  });
});