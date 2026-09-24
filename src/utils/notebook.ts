import type { SequenceAnalysis, SequenceComparison } from './sequence';
import { deleteCloudExperiment, hasCloudSession, pullExperiments, syncExperiment as syncCloudExperiment } from '../services/cloud';

export interface ExperimentRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sequence?: string;
  comparisonSequence?: string;
  analysis?: SequenceAnalysis;
  comparison?: SequenceComparison;
  notes: string;
  tags: string[];
  references: NotebookReference[];
  dataPoints: NotebookDataPoint[];
  ownerEmail?: string;
}

export interface NotebookDataPoint {
  label: string;
  value: string;
}

export interface NotebookReference {
  kind: 'gene' | 'variant' | 'publication' | 'analysis';
  id: string;
  label: string;
  url?: string;
  data?: unknown;
}

const storageKey = 'genelab-experiments';

const readExperiments = (): ExperimentRecord[] => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(value) ? value as ExperimentRecord[] : [];
  } catch {
    return [];
  }
};

const writeExperiments = (experiments: ExperimentRecord[]): void => localStorage.setItem(storageKey, JSON.stringify(experiments));
const normalizeExperiment = (experiment: ExperimentRecord): ExperimentRecord => ({ ...experiment, tags: experiment.tags ?? [], references: experiment.references ?? [], dataPoints: experiment.dataPoints ?? [] });

export const getExperiments = (ownerEmail?: string): ExperimentRecord[] => readExperiments().map(normalizeExperiment).filter((experiment) => !ownerEmail || experiment.ownerEmail === ownerEmail || !experiment.ownerEmail).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

export const saveExperiment = (experiment: Omit<ExperimentRecord, 'id' | 'createdAt' | 'updatedAt'>): ExperimentRecord => {
  const now = new Date().toISOString();
  const record: ExperimentRecord = { ...experiment, references: experiment.references ?? [], dataPoints: (experiment.dataPoints ?? []).slice(0, 20), id: `EXP-${Date.now().toString(36).toUpperCase()}`, createdAt: now, updatedAt: now };
  writeExperiments([record, ...readExperiments()]);
  return record;
};

export const deleteExperiment = (id: string): void => writeExperiments(readExperiments().filter((experiment) => experiment.id !== id));

export const syncExperimentRecord = async (experiment: ExperimentRecord): Promise<void> => { if (hasCloudSession()) await syncCloudExperiment(experiment); };

export const syncExperimentsFromCloud = async (): Promise<ExperimentRecord[]> => {
  if (!hasCloudSession()) return getExperiments();
  const remote = await pullExperiments();
  const local = readExperiments();
  const merged = [...remote, ...local.filter((item) => !remote.some((remoteItem) => remoteItem.id === item.id))];
  writeExperiments(merged);
  return getExperiments();
};

export const deleteExperimentEverywhere = async (id: string): Promise<void> => { deleteExperiment(id); if (hasCloudSession()) await deleteCloudExperiment(id); };
