import type { ScientificSource } from '../models/scientific';
import { t } from '../i18n';

const categoryKey: Record<ScientificSource['category'], Parameters<typeof t>[0]> = {
  'primary-literature': 'source.primary',
  'curated-database': 'source.curated',
  'reference-database': 'source.reference',
  'computational-prediction': 'source.prediction',
  'ai-explanation': 'source.ai',
  'user-provided': 'source.user',
};

const safe = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export const renderEvidence = (sources: ScientificSource[]): string => `<section class="evidence-panel" aria-labelledby="evidence-title"><div class="panel-heading"><p class="eyebrow">${t('explorer.evidence')}</p><h2 id="evidence-title">${sources.length} ${t('explorer.source')}</h2></div>${sources.length ? `<div class="evidence-list">${sources.map((source) => `<article class="evidence-item"><div><strong>${safe(source.name)}</strong><span>${t(categoryKey[source.category])}</span></div><dl><div><dt>${t('explorer.identifier')}</dt><dd>${safe(source.identifier ?? t('explorer.noData'))}</dd></div>${source.retrievedAt ? `<div><dt>${t('explorer.retrieved')}</dt><dd>${safe(source.retrievedAt)}</dd></div>` : ''}</dl>${source.url ? `<a class="text-link" href="${safe(source.url)}" target="_blank" rel="noopener noreferrer">${t('explorer.openSource')} -&gt;</a>` : ''}${source.limitations?.length ? `<p class="source-note">${t('explorer.notes')}: ${source.limitations.map(safe).join(' ')}</p>` : ''}</article>`).join('')}</div>` : `<p class="empty-state">${t('explorer.noData')}</p>`}</section>`;