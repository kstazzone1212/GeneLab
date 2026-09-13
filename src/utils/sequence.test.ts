import { describe, expect, it } from 'vitest';
import { analyzeSequence, calculateGcPercentage, reverseComplement, transcribeDna, translateRna } from './sequence';

describe('sequence analysis', () => {
  it('calculates DNA metrics and transformations', () => {
    expect(calculateGcPercentage('ATGC')).toBe(50);
    expect(transcribeDna('ATGC')).toBe('AUGC');
    expect(reverseComplement('ATGC')).toBe('GCAT');
    expect(translateRna('AUGGCC')).toBe('MA');
  });

  it('returns structured results and rejects unknown alphabets', () => {
    expect(analyzeSequence('ATGCCG')).toMatchObject({ alphabet: 'DNA', length: 6, gcPercentage: 66.67 });
    expect(analyzeSequence('123')).toMatchObject({ alphabet: 'unknown', length: 0 });
  });

  it('accepts FASTA headers and multiline DNA sequences', () => {
    expect(analyzeSequence('>SHANK3 transcript\nATGCCG\nTTAA')).toMatchObject({ alphabet: 'DNA', length: 10 });
  });

  it('recognizes protein sequences with extended amino-acid symbols', () => {
    expect(analyzeSequence('>SHANK3 protein\nMKWVTFISLLFLFSSAYSRGVFRR\n')).toMatchObject({ alphabet: 'protein', length: 24 });
    expect(analyzeSequence('ACDEFGHIKLMNPQRSTVWYBXZOU')).toMatchObject({ alphabet: 'protein' });
  });

  it('recognizes ambiguous nucleotide FASTA sequences', () => {
    expect(analyzeSequence('>sequence\nATGNNRY')).toMatchObject({ alphabet: 'DNA', length: 7 });
  });
});
