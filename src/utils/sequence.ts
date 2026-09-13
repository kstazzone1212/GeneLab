export interface SequenceAnalysis {
  length: number;
  gcPercentage: number;
  alphabet: 'DNA' | 'RNA' | 'protein' | 'unknown';
  transcription?: string;
  reverseComplement?: string;
  translation?: string;
}

const dnaComplement: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };
const codons: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L', TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S', TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W', CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L', CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q', CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R', ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T', AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K', AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V', GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A', GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

const nucleotideAlphabet = 'ACGTRYSWKMBDHVN';
const proteinAlphabet = 'ABCDEFGHIKLMNOPQRSTUVWYZX*';

export const cleanSequence = (sequence: string): string => sequence
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith('>') && !line.trim().startsWith(';'))
  .join('')
  .toUpperCase()
  .replaceAll(/[\s0-9.\-]/g, '');
export const detectAlphabet = (sequence: string): SequenceAnalysis['alphabet'] => {
  const cleaned = cleanSequence(sequence);
  if (cleaned && [...cleaned].every((base) => nucleotideAlphabet.includes(base))) {
    return cleaned.includes('U') ? 'RNA' : 'DNA';
  }
  if (cleaned && [...cleaned].every((aminoAcid) => proteinAlphabet.includes(aminoAcid))) return 'protein';
  return 'unknown';
};
export const calculateGcPercentage = (sequence: string): number => { const cleaned = cleanSequence(sequence); return cleaned.length ? Number((((cleaned.match(/[GC]/g) ?? []).length / cleaned.length) * 100).toFixed(2)) : 0; };
export const transcribeDna = (sequence: string): string => cleanSequence(sequence).replaceAll('T', 'U');
export const reverseComplement = (sequence: string): string => cleanSequence(sequence).split('').reverse().map((base) => dnaComplement[base] ?? 'N').join('');
export const translateRna = (sequence: string): string => { const rna = cleanSequence(sequence).replaceAll('U', 'T'); let protein = ''; for (let index = 0; index + 2 < rna.length; index += 3) protein += codons[rna.slice(index, index + 3)] ?? 'X'; return protein; };
export const analyzeSequence = (sequence: string): SequenceAnalysis => { const cleaned = cleanSequence(sequence); const alphabet = detectAlphabet(cleaned); if (alphabet === 'DNA') return { length: cleaned.length, gcPercentage: calculateGcPercentage(cleaned), alphabet, transcription: transcribeDna(cleaned), reverseComplement: reverseComplement(cleaned), translation: translateRna(cleaned) }; if (alphabet === 'RNA') return { length: cleaned.length, gcPercentage: calculateGcPercentage(cleaned), alphabet, translation: translateRna(cleaned) }; return { length: cleaned.length, gcPercentage: 0, alphabet }; };
