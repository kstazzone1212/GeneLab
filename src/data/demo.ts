import type { Gene, ScientificSource, Variant } from '../models/scientific';

export const demoSource: ScientificSource = {
  id: 'genelab-demo',
  name: 'GeneLab demo registry',
  category: 'user-provided',
  identifier: 'DEMO-DATASET-PHASE-2',
  limitations: ['Synthetic records for interface testing only. Not a scientific database.'],
};

const demoSourceFor = (identifier: string): ScientificSource => ({ ...demoSource, identifier });

export const demoGenes: Gene[] = [
  {
    id: 'DEMO-GENE-ALPHA', symbol: 'DEMO1', name: 'Example locus alpha (synthetic demo record)', organism: 'Demo organism',
    chromosome: 'demo-chr-1', location: { assembly: 'DEMO-ASSEMBLY-1', chromosome: 'demo-chr-1', start: 1000, end: 2400, strand: '+' },
    description: 'Synthetic gene metadata used to exercise GeneLab navigation and evidence components.', aliases: ['EXAMPLE_ALPHA'],
    transcripts: [{ id: 'DEMO-TX-001', geneId: 'DEMO-GENE-ALPHA', source: demoSourceFor('DEMO-TX-001'), status: 'demo' }],
    proteins: [{ id: 'DEMO-PROT-001', name: 'Example protein alpha', geneId: 'DEMO-GENE-ALPHA', organism: 'Demo organism', aminoAcidLength: 240, sources: [demoSourceFor('DEMO-PROT-001')] }],
    externalIdentifiers: {}, sources: [demoSourceFor('DEMO-GENE-ALPHA')],
  },
  {
    id: 'DEMO-GENE-BETA', symbol: 'DEMO2', name: 'Example locus beta (synthetic demo record)', organism: 'Demo organism',
    chromosome: 'demo-chr-2', location: { assembly: 'DEMO-ASSEMBLY-1', chromosome: 'demo-chr-2', start: 5000, end: 6900, strand: '-' },
    description: 'Synthetic gene metadata used to exercise empty-state behavior.', aliases: ['EXAMPLE_BETA'],
    transcripts: [{ id: 'DEMO-TX-002', geneId: 'DEMO-GENE-BETA', source: demoSourceFor('DEMO-TX-002') }],
    proteins: [], externalIdentifiers: {}, sources: [demoSourceFor('DEMO-GENE-BETA')],
  },
];

export const demoVariants: Variant[] = [
  {
    id: 'DEMO-VAR-001', geneId: 'DEMO-GENE-ALPHA', genomicChange: 'g.1400A>G', referenceAllele: 'A', alternateAllele: 'G',
    location: { assembly: 'DEMO-ASSEMBLY-1', chromosome: 'demo-chr-1', start: 1400, end: 1400, strand: '+' }, transcriptChange: 'c.121A>G',
    proteinChange: 'p.Example41Example', variantType: 'SNV', consequence: 'missense', frequency: 'Not available in demo data', evidence: [demoSourceFor('DEMO-VAR-001')],
  },
  {
    id: 'DEMO-VAR-002', geneId: 'DEMO-GENE-ALPHA', genomicChange: 'g.1820del', referenceAllele: 'A', alternateAllele: '-',
    location: { assembly: 'DEMO-ASSEMBLY-1', chromosome: 'demo-chr-1', start: 1820, end: 1820, strand: '+' }, transcriptChange: 'c.541del',
    variantType: 'deletion', consequence: 'frameshift', evidence: [demoSourceFor('DEMO-VAR-002')],
  },
];