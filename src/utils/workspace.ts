export type SavedItemKind = 'gene' | 'variant';

export interface SavedItem {
  kind: SavedItemKind;
  id: string;
  label: string;
  subtitle: string;
  savedAt: string;
}

export interface HistoryEntry {
  kind: string;
  id: string;
  label: string;
  href: string;
  visitedAt: string;
}

const savedKey = 'genelab-saved-items';
const historyKey = 'genelab-history';
const notesKey = 'genelab-notes';

const read = <T>(key: string): T[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
};

const write = <T>(key: string, value: T[]): void => localStorage.setItem(key, JSON.stringify(value));

const readNotes = (): Record<string, string> => {
  try {
    const value = JSON.parse(localStorage.getItem(notesKey) ?? '{}');
    return typeof value === 'object' && value !== null ? value as Record<string, string> : {};
  } catch {
    return {};
  }
};

export const getSavedItems = (): SavedItem[] => read<SavedItem>(savedKey);

export const isSaved = (kind: SavedItemKind, id: string): boolean => getSavedItems().some((item) => item.kind === kind && item.id === id);

export const toggleSaved = (item: Omit<SavedItem, 'savedAt'>): boolean => {
  const items = getSavedItems();
  const existing = items.findIndex((saved) => saved.kind === item.kind && saved.id === item.id);
  if (existing >= 0) {
    items.splice(existing, 1);
    write(savedKey, items);
    return false;
  }
  write(savedKey, [{ ...item, savedAt: new Date().toISOString() }, ...items].slice(0, 50));
  return true;
};

export const addHistoryEntry = (entry: Omit<HistoryEntry, 'visitedAt'>): void => {
  const history = read<HistoryEntry>(historyKey).filter((item) => item.href !== entry.href);
  write(historyKey, [{ ...entry, visitedAt: new Date().toISOString() }, ...history].slice(0, 20));
};

export const getHistory = (): HistoryEntry[] => read<HistoryEntry>(historyKey);

export const getNote = (kind: SavedItemKind, id: string): string => readNotes()[`${kind}:${id}`] ?? '';

export const setNote = (kind: SavedItemKind, id: string, note: string): void => { const notes = readNotes(); const key = `${kind}:${id}`; if (note.trim()) notes[key] = note.trim(); else delete notes[key]; localStorage.setItem(notesKey, JSON.stringify(notes)); };
