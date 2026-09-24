export interface SequenceAnalysis {
  length: number;
  gcPercentage: number;
  alphabet: 'DNA' | 'RNA' | 'protein' | 'unknown';
  transcription?: string;
  reverseComplement?: string;
  translation?: string;
  orfs?: OpenReadingFrame[];
  restrictionSites?: RestrictionSite[];
  primers?: PrimerCandidate[];
}

export interface OpenReadingFrame {
  frame: number;
  start: number;
  end: number;
  protein: string;
}

export interface RestrictionSite {
  enzyme: string;
  recognitionSite: string;
  position: number;
}

export interface PrimerCandidate {
  direction: 'forward' | 'reverse';
  sequence: string;
  start: number;
  end: number;
  gcPercentage: number;
  meltingTemperature: number;
  warnings: string[];
}

export interface SequenceDifference {
  position: number;
  reference: string;
  query: string;
}

export interface SequenceComparison {
  referenceLength: number;
  queryLength: number;
  comparedLength: number;
  identityPercentage: number;
  differences: SequenceDifference[];
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
const restrictionEnzymes: Array<Pick<RestrictionSite, 'enzyme' | 'recognitionSite'>> = [
  { enzyme: 'EcoRI', recognitionSite: 'GAATTC' },
  { enzyme: 'BamHI', recognitionSite: 'GGATCC' },
  { enzyme: 'HindIII', recognitionSite: 'AAGCTT' },
  { enzyme: 'PstI', recognitionSite: 'CTGCAG' },
  { enzyme: 'SmaI', recognitionSite: 'CCCGGG' },
];

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

const findOrfsOnStrand = (sequence: string, strand: 1 | -1): OpenReadingFrame[] => {
  const results: OpenReadingFrame[] = [];
  for (let frame = 0; frame < 3; frame += 1) {
    for (let start = frame; start + 2 < sequence.length; start += 3) {
      if (sequence.slice(start, start + 3) !== 'ATG') continue;
      for (let end = start + 3; end + 2 < sequence.length; end += 3) {
        if (!['TAA', 'TAG', 'TGA'].includes(sequence.slice(end, end + 3))) continue;
        const protein = translateRna(sequence.slice(start, end + 3));
        if (protein.length >= 3) results.push({ frame: strand * (frame + 1), start: start + 1, end: end + 3, protein });
        break;
      }
    }
  }
  return results;
};

export const findOpenReadingFrames = (sequence: string): OpenReadingFrame[] => {
  const cleaned = cleanSequence(sequence).replaceAll('U', 'T');
  return [...findOrfsOnStrand(cleaned, 1), ...findOrfsOnStrand(reverseComplement(cleaned), -1)];
};

export const findRestrictionSites = (sequence: string): RestrictionSite[] => {
  const cleaned = cleanSequence(sequence).replaceAll('U', 'T');
  return restrictionEnzymes.flatMap(({ enzyme, recognitionSite }) => {
    const sites: RestrictionSite[] = [];
    let position = cleaned.indexOf(recognitionSite);
    while (position >= 0) {
      sites.push({ enzyme, recognitionSite, position: position + 1 });
      position = cleaned.indexOf(recognitionSite, position + 1);
    }
    return sites;
  });
};

const calculateMeltingTemperature = (sequence: string): number => {
  const counts = sequence.match(/[ATGC]/g) ?? [];
  return 2 * (counts.filter((base) => base === 'A' || base === 'T').length) + 4 * (counts.filter((base) => base === 'G' || base === 'C').length);
};

const makePrimer = (sequence: string, direction: PrimerCandidate['direction'], start: number, end: number): PrimerCandidate => {
  const gcPercentage = calculateGcPercentage(sequence);
  const meltingTemperature = calculateMeltingTemperature(sequence);
  const warnings: string[] = [];
  if (gcPercentage < 40 || gcPercentage > 60) warnings.push('gc-range');
  if (meltingTemperature < 50 || meltingTemperature > 65) warnings.push('tm-range');
  if (/(A{5,}|T{5,}|G{5,}|C{5,})/.test(sequence)) warnings.push('homopolymer');
  return { direction, sequence, start, end, gcPercentage, meltingTemperature, warnings };
};

export const designPrimers = (sequence: string, length = 20): PrimerCandidate[] => {
  const cleaned = cleanSequence(sequence).replaceAll('U', 'T');
  if (cleaned.length < length * 2) return [];
  const forward = cleaned.slice(0, length);
  const reverseStart = cleaned.length - length;
  const reverse = reverseComplement(cleaned.slice(reverseStart));
  return [makePrimer(forward, 'forward', 1, length), makePrimer(reverse, 'reverse', reverseStart + 1, cleaned.length)];
};

export const compareSequences = (reference: string, query: string): SequenceComparison => {
  const referenceValue = cleanSequence(reference);
  const queryValue = cleanSequence(query);
  const comparedLength = Math.max(referenceValue.length, queryValue.length);
  const differences: SequenceDifference[] = [];
  let matches = 0;
  for (let index = 0; index < comparedLength; index += 1) {
    const referenceBase = referenceValue[index] ?? '-';
    const queryBase = queryValue[index] ?? '-';
    if (referenceBase === queryBase) matches += 1;
    else differences.push({ position: index + 1, reference: referenceBase, query: queryBase });
  }
  return { referenceLength: referenceValue.length, queryLength: queryValue.length, comparedLength, identityPercentage: comparedLength ? Number(((matches / comparedLength) * 100).toFixed(2)) : 0, differences };
};

export const analyzeSequence = (sequence: string): SequenceAnalysis => { const cleaned = cleanSequence(sequence); const alphabet = detectAlphabet(cleaned); if (alphabet === 'DNA') return { length: cleaned.length, gcPercentage: calculateGcPercentage(cleaned), alphabet, transcription: transcribeDna(cleaned), reverseComplement: reverseComplement(cleaned), translation: translateRna(cleaned), orfs: findOpenReadingFrames(cleaned), restrictionSites: findRestrictionSites(cleaned), primers: designPrimers(cleaned) }; if (alphabet === 'RNA') return { length: cleaned.length, gcPercentage: calculateGcPercentage(cleaned), alphabet, translation: translateRna(cleaned) }; return { length: cleaned.length, gcPercentage: 0, alphabet }; };
