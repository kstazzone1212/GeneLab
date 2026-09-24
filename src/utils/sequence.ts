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

export type PopulationBand = 'common' | 'intermediate' | 'rare' | 'very-rare' | 'unknown';

export interface VariantObservation {
  position: number;
  reference: string;
  alternate: string;
  alleleFrequency?: number;
  frequencyPercent: number;
  oneInEvery: number;
  classification: string;
  populationBand: PopulationBand;
}

export interface SequenceFileSummary {
  format: 'fasta' | 'vcf' | 'unknown';
  fileTypeLabel: string;
  geneCount: number;
  totalLength: number;
  variantCount: number;
  variants: VariantObservation[];
  populationSummary: string;
  pathogenicity: string;
  alleleFrequencyPercent: number;
  oneInEvery: number;
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

const parseFastaRecords = (input: string): Array<{ header: string; sequence: string }> => {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records: Array<{ header: string; sequence: string }> = [];
  let current: { header: string; sequence: string } | undefined;

  for (const line of lines) {
    if (line.startsWith('>')) {
      if (current) records.push(current);
      current = { header: line.slice(1).trim(), sequence: '' };
      continue;
    }
    if (!current) {
      current = { header: 'sequence', sequence: '' };
    }
    current.sequence += cleanSequence(line);
  }

  if (current) records.push(current);
  return records;
};

const inferPopulationBand = (alleleFrequency?: number): PopulationBand => {
  if (alleleFrequency === undefined) return 'unknown';
  if (alleleFrequency >= 0.05) return 'common';
  if (alleleFrequency >= 0.01) return 'intermediate';
  if (alleleFrequency >= 0.001) return 'rare';
  return 'very-rare';
};

const inferVariantClassification = (variantType: string, alleleFrequency?: number, info = ''): string => {
  const normalized = `${variantType} ${info}`.toLowerCase();
  const pathogenicSignals = ['pathogenic', 'stop_gain', 'stop-gained', 'frameshift', 'splice', 'nonsense', 'missense'];
  const benignSignals = ['benign', 'likely_benign', 'synonymous', 'intron', 'intergenic'];

  if (pathogenicSignals.some((marker) => normalized.includes(marker))) return alleleFrequency !== undefined && alleleFrequency < 0.01 ? 'Likely pathogenic' : 'Pathogenic / clinically significant';
  if (benignSignals.some((marker) => normalized.includes(marker))) return alleleFrequency !== undefined && alleleFrequency > 0.05 ? 'Common benign variant' : 'Likely benign';
  if (alleleFrequency !== undefined) {
    if (alleleFrequency > 0.05) return 'Common population variant';
    if (alleleFrequency > 0.01) return 'Insignificant / low impact';
    if (alleleFrequency > 0.001) return 'Rare variant';
    return 'Very rare / potentially relevant';
  }
  return 'Insignificant / uncertain';
};

const parseAlleleFrequency = (info: string): number | undefined => {
  const matches = [
    /(?:^|;)AF=([^;]+)/i,
    /(?:^|;)AFR=([^;]+)/i,
    /(?:^|;)MAX_AF=([^;]+)/i,
    /(?:^|;)ALLELE_FREQUENCY=([^;]+)/i,
  ].map((pattern) => info.match(pattern)?.[1]).find((value): value is string => Boolean(value));

  if (!matches) return undefined;
  const numericValues = matches.split(',').map((value) => Number.parseFloat(value)).filter((value) => Number.isFinite(value));
  return numericValues.length ? Math.max(...numericValues) : undefined;
};

const summarizeVariantLine = (line: string): VariantObservation | undefined => {
  if (!line || line.startsWith('#')) return undefined;
  const columns = line.split(/\s+/);
  if (columns.length < 8) return undefined;
  const [, positionValue, , reference, alternate] = columns;
  if (!positionValue || !reference || !alternate) return undefined;

  const position = Number.parseInt(positionValue, 10);
  const info = columns.slice(7).join(' ');
  const alleleFrequency = parseAlleleFrequency(info);
  const frequencyPercent = alleleFrequency === undefined ? 0 : Number((alleleFrequency * 100).toFixed(4));
  const oneInEvery = alleleFrequency && alleleFrequency > 0 ? Math.max(1, Math.round(1 / alleleFrequency)) : 0;
  const variantType = reference.length === alternate.length ? (reference.length === 1 ? 'SNV' : 'indel') : reference.length < alternate.length ? 'insertion' : 'deletion';

  return {
    position,
    reference,
    alternate,
    alleleFrequency,
    frequencyPercent,
    oneInEvery,
    classification: inferVariantClassification(variantType, alleleFrequency, info),
    populationBand: inferPopulationBand(alleleFrequency),
  };
};

export const summarizeSequenceFile = (input: string): SequenceFileSummary => {
  const content = input.trim();
  if (!content) {
    return { format: 'unknown', fileTypeLabel: 'Unknown', geneCount: 0, totalLength: 0, variantCount: 0, variants: [], populationSummary: 'No sequence content was loaded.', pathogenicity: 'Insignificant / uncertain', alleleFrequencyPercent: 0, oneInEvery: 0 };
  }

  const vcfLines = content.split(/\r?\n/).filter((line) => line.startsWith('#CHROM') || (!line.startsWith('#') && /\s+[ACGTN]+\s+[ACGTN]+/i.test(line)));
  if (content.includes('#CHROM') || vcfLines.length > 1) {
    const variants = content.split(/\r?\n/).map((line) => summarizeVariantLine(line)).filter((variant): variant is VariantObservation => Boolean(variant));
    const strongest = variants.reduce((current, variant) => {
      const frequency = variant.alleleFrequency ?? 0;
      return current === undefined || frequency < (current.alleleFrequency ?? 0) ? variant : current;
    }, variants[0]);

    const summaryText = variants.length
      ? `VCF file with ${variants.length} variant call${variants.length === 1 ? '' : 's'}; the most frequent allele is ${strongest?.alleleFrequency ? (strongest.alleleFrequency * 100).toFixed(2) : '0.00'}% in the population.`
      : 'VCF file loaded but no valid variant rows were detected.';

    const pathogenicity = variants.some((variant) => /pathogenic|rare|very-rare/i.test(variant.classification))
      ? 'Likely pathogenic / population rare'
      : variants.some((variant) => /benign|common/i.test(variant.classification))
        ? 'Likely benign / insignificant'
        : 'Insignificant / uncertain';

    return {
      format: 'vcf',
      fileTypeLabel: 'VCF',
      geneCount: Math.max(1, new Set(content.split(/\r?\n/).filter((line) => line.startsWith('#CHROM')).map(() => 'chr')).size),
      totalLength: variants.reduce((total, variant) => total + Math.max(1, variant.position), 0),
      variantCount: variants.length,
      variants,
      populationSummary: summaryText,
      pathogenicity,
      alleleFrequencyPercent: strongest?.frequencyPercent ?? 0,
      oneInEvery: strongest?.oneInEvery ?? 0,
    };
  }

  const fastaRecords = parseFastaRecords(content);
  if (fastaRecords.length) {
    const sequences = fastaRecords.map((record) => record.sequence).filter((sequence) => sequence.length > 0);
    const ambiguousSites = sequences.flatMap((sequence) => [...sequence].map((base, index) => ({ base, index })).filter(({ base }) => /[RYSWKMBDHVN]/.test(base)));
    const candidates = ambiguousSites.slice(0, 12).map(({ base, index }) => ({
      position: index + 1,
      reference: 'N',
      alternate: base,
      alleleFrequency: undefined,
      frequencyPercent: 0,
      oneInEvery: 0,
      classification: 'Insignificant / uncertain candidate variant',
      populationBand: 'unknown' as const,
    }));

    return {
      format: 'fasta',
      fileTypeLabel: 'FASTA',
      geneCount: fastaRecords.length,
      totalLength: sequences.reduce((total, sequence) => total + sequence.length, 0),
      variantCount: candidates.length,
      variants: candidates,
      populationSummary: candidates.length ? `FASTA file with ${candidates.length} candidate variant position${candidates.length === 1 ? '' : 's'}; population frequency is not available without a VCF annotation.` : 'FASTA file loaded without explicit variant annotations; no population frequency data is available.',
      pathogenicity: candidates.length ? 'Insignificant / uncertain until VCF annotations are added' : 'No pathogenicity signal detected in this FASTA sequence',
      alleleFrequencyPercent: 0,
      oneInEvery: 0,
    };
  }

  return {
    format: 'unknown',
    fileTypeLabel: 'Unknown',
    geneCount: 0,
    totalLength: content.length,
    variantCount: 0,
    variants: [],
    populationSummary: 'Sequence content could not be parsed as FASTA or VCF.',
    pathogenicity: 'Insignificant / uncertain',
    alleleFrequencyPercent: 0,
    oneInEvery: 0,
  };
};

export const parseSequenceFile = (input: string): SequenceFileSummary => summarizeSequenceFile(input);

export const parseFastaData = (input: string): Array<{ header: string; sequence: string }> => parseFastaRecords(input);

