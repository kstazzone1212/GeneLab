import './styles/main.css';
import { getLocale, setLocale, t } from './i18n';
import { renderGeneDetails, renderSearchPage, renderVariantDetails, renderVariantExplorer } from './components/explorer';
import { renderAboutPage, renderAssistantPage, renderLabPage, renderLiteraturePage, renderSourcesPage } from './components/sitePages';
import { demoGeneService, demoVariantService, applyVariantFilters } from './services/demo';
import { liveGeneService } from './services/live';
import { liveVariantService } from './services/liveVariants';
import { liveLiteratureService } from './services/liveLiterature';
import { analyzeSequence } from './utils/sequence';

type Route = { kind: 'home' | 'genes' | 'gene' | 'variants' | 'variant' | 'literature' | 'lab' | 'assistant' | 'about' | 'sources' | 'planned'; id?: string; query: URLSearchParams };
type PlannedRoute = 'literature' | 'lab' | 'assistant' | 'about' | 'sources' | 'variants';

const plannedRoutes: Record<PlannedRoute, string> = { literature: 'literature', lab: 'lab', assistant: 'assistant', about: 'about', sources: 'sources', variants: 'variants' };
const navItems: Array<{ route: string; key: Parameters<typeof t>[0] }> = [
  { route: '', key: 'nav.home' }, { route: 'genes', key: 'nav.genes' }, { route: 'variants', key: 'nav.variants' },
  { route: 'literature', key: 'nav.literature' }, { route: 'lab', key: 'nav.lab' }, { route: 'assistant', key: 'nav.assistant' },
  { route: 'about', key: 'nav.about' }, { route: 'sources', key: 'nav.sources' },
];

const parseRoute = (): Route => {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, search = ''] = raw.split('?');
  const segments = path.split('/').filter(Boolean);
  const query = new URLSearchParams(search);
  if (!segments.length) return { kind: 'home', query };
  if (segments[0] === 'genes') return { kind: 'genes', query };
  if (segments[0] === 'gene' && segments[1]) return { kind: 'gene', id: decodeURIComponent(segments[1]), query };
  if (segments[0] === 'variants') return { kind: 'variants', query };
  if (segments[0] === 'variant' && segments[1]) return { kind: 'variant', id: decodeURIComponent(segments[1]), query };
  if (['literature', 'lab', 'assistant', 'about', 'sources'].includes(segments[0])) return { kind: segments[0] as Route['kind'], query };
  if (plannedRoutes[segments[0] as PlannedRoute]) return { kind: 'planned', id: segments[0], query };
  return { kind: 'home', query };
};

const activePath = (route: Route): string => route.kind === 'home' ? '' : route.kind === 'gene' ? 'genes' : route.kind === 'variant' || route.kind === 'variants' ? 'variants' : route.id ?? route.kind;
const renderNav = (route: Route): string => navItems.map(({ route: path, key }) => `<a class="nav-link ${activePath(route) === path ? 'is-active' : ''}" href="#/${path}" ${activePath(route) === path ? 'aria-current="page"' : ''}>${t(key)}</a>`).join('');

const renderHome = (): string => `<section class="hero" aria-labelledby="home-title"><div class="hero-copy"><p class="eyebrow">${t('home.eyebrow')} <span class="status-chip">${t('home.status')}</span></p><h1 id="home-title">${t('home.title')}</h1><p class="hero-description">${t('home.description')}</p><form class="search-form" id="search-form" role="search"><label class="sr-only" for="global-search">${t('home.searchPlaceholder')}</label><input id="global-search" name="query" type="search" placeholder="${t('home.searchPlaceholder')}" /><button type="submit">${t('home.searchAction')} <span aria-hidden="true">-&gt;</span></button></form></div><div class="hero-mark" aria-hidden="true"><span>G</span><span>A</span><span>T</span><span>C</span></div></section><section class="workflow" aria-labelledby="workflow-title"><div class="section-heading"><p class="eyebrow">01 / ${t('home.workflow')}</p><h2 id="workflow-title">${t('home.workflowDescription')}</h2></div><ol class="workflow-list">${(['search', 'explore', 'analyze', 'evidence', 'interpret'] as const).map((step, index) => `<li><span>0${index + 1}</span><strong>${t(`workflow.${step}`)}</strong></li>`).join('')}</ol></section><aside class="notice" aria-labelledby="notice-title"><div><p class="eyebrow">${t('home.noticeTitle')}</p><p id="notice-title">${t('home.notice')}</p></div><span class="notice-icon" aria-hidden="true">i</span></aside><section class="coming-next"><p class="eyebrow">${t('explorer.comingNext')}</p><p>${t('explorer.comingNextText')}</p></section>`;

const renderPlanned = (route: string): string => `<section class="placeholder" aria-labelledby="placeholder-title"><p class="eyebrow">${t(navItems.find((item) => item.route === route)?.key ?? 'nav.home')}</p><h1 id="placeholder-title">${t('status.planned')}</h1><p>${t('page.comingSoon')}</p><a class="text-link" href="#/">${t('page.backHome')} -&gt;</a></section>`;
const renderLoading = (): string => `<section class="state-panel" role="status"><span class="loader" aria-hidden="true"></span><p>${t('explorer.loading')}</p></section>`;
const escapeText = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const renderError = (errorCode?: 'network' | 'not-found' | 'rate-limited' | 'malformed' | 'unavailable', requested?: string): string => { const message = errorCode === 'not-found' ? (requested ? t('explorer.notFoundFor').replace('{gene}', escapeText(requested)) : t('explorer.notFound')) : errorCode === 'rate-limited' ? t('explorer.rateLimited') : t('explorer.fetchError'); return `<section class="state-panel error-state" role="alert"><p>${message}</p><a class="text-link" href="#/genes">${t('nav.genes')} -&gt;</a></section>`; };

const renderShell = (route: Route): void => {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<header class="site-header"><a class="brand" href="#/"><span class="brand-mark">GL</span><span><strong>GeneLab</strong><small>${t('brand.tagline')}</small></span></a><nav class="desktop-nav" aria-label="${t('nav.primary')}">${renderNav(route)}</nav><div class="header-actions"><button class="icon-button" id="language-toggle" type="button" aria-label="${t('language.switch')}">${getLocale().toUpperCase()}</button><button class="icon-button" id="theme-toggle" type="button" aria-label="${t('theme.toggle')}">◐</button></div></header><main id="page-content">${route.kind === 'home' ? renderHome() : route.kind === 'planned' ? renderPlanned(route.id ?? '') : renderLoading()}</main><footer><span>GeneLab</span><span>${t('footer.phase')}</span></footer>`;
  document.documentElement.lang = getLocale();
  document.querySelector<HTMLButtonElement>('#language-toggle')?.addEventListener('click', () => { setLocale(getLocale() === 'en' ? 'es' : 'en'); render(); });
  document.querySelector<HTMLButtonElement>('#theme-toggle')?.addEventListener('click', () => document.documentElement.classList.toggle('dark'));
  document.querySelector<HTMLFormElement>('#search-form')?.addEventListener('submit', (event) => { event.preventDefault(); const query = new FormData(event.currentTarget as HTMLFormElement).get('query')?.toString() ?? ''; window.location.hash = `#/genes?q=${encodeURIComponent(query)}`; });
};

const bindGeneSearch = (): void => document.querySelector<HTMLFormElement>('#gene-search-form')?.addEventListener('submit', (event) => { event.preventDefault(); const query = new FormData(event.currentTarget as HTMLFormElement).get('query')?.toString() ?? ''; window.location.hash = `#/genes?q=${encodeURIComponent(query)}`; });
const bindVariantFilters = (geneId: string): void => document.querySelector<HTMLFormElement>('#variant-filters')?.addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); const type = data.get('type')?.toString() ?? ''; const consequence = data.get('consequence')?.toString() ?? ''; window.location.hash = `#/variants?gene=${encodeURIComponent(geneId)}&type=${encodeURIComponent(type)}&consequence=${encodeURIComponent(consequence)}`; });
const bindVariantSearch = (): void => { const form = document.querySelector<HTMLFormElement>('#variant-search-form'); const input = document.querySelector<HTMLInputElement>('#variant-query'); if (!form || !input) return; form.addEventListener('submit', (event) => { event.preventDefault(); const query = input.value.trim(); if (query) window.location.hash = `#/variants?q=${encodeURIComponent(query)}`; }); };
const bindLiteratureSearch = (): void => document.querySelector<HTMLFormElement>('#literature-search-form')?.addEventListener('submit', (event) => { event.preventDefault(); const query = new FormData(event.currentTarget as HTMLFormElement).get('query')?.toString() ?? ''; window.location.hash = `#/literature?q=${encodeURIComponent(query)}`; });
const bindLab = (): void => document.querySelector<HTMLFormElement>('#sequence-form')?.addEventListener('submit', (event) => { event.preventDefault(); const sequence = new FormData(event.currentTarget as HTMLFormElement).get('sequence')?.toString() ?? ''; const analysis = analyzeSequence(sequence); const target = document.querySelector<HTMLDivElement>('#page-content'); if (target) { target.innerHTML = renderLabPage(analysis.alphabet === 'unknown' ? undefined : analysis, analysis.alphabet === 'unknown'); bindLab(); } });
const bindAssistant = (): void => document.querySelector<HTMLFormElement>('#assistant-search-form')?.addEventListener('submit', (event) => { event.preventDefault(); const query = new FormData(event.currentTarget as HTMLFormElement).get('query')?.toString() ?? ''; window.location.hash = `#/assistant?q=${encodeURIComponent(query)}`; });
let latestRequestId = 0;

const renderVariantGene = async (target: HTMLDivElement, requestId: number, route: Route, gene: import('./models/scientific').Gene, demoMode: boolean, directVariant?: import('./models/scientific').Variant): Promise<void> => {
  const variants = directVariant ? { data: [directVariant] } : await (demoMode ? demoVariantService : liveVariantService).getVariantsForGene(gene.id);
  const filtered = applyVariantFilters(variants.data ?? [], { type: route.query.get('type') || undefined, consequence: route.query.get('consequence') || undefined });
  if (requestId !== latestRequestId) return;
  target.innerHTML = renderVariantExplorer(gene, filtered, route.query.get('type') ?? '', route.query.get('consequence') ?? '', demoMode ? 'demo' : 'live', route.query.get('q') ?? '');
  bindVariantFilters(gene.id);
  bindVariantSearch();
};

const loadContent = async (route: Route, requestId: number): Promise<void> => {
  const target = document.querySelector<HTMLDivElement>('#page-content');
  if (!target) return;
  const demoMode = route.query.get('demo') === '1';
  const geneService = demoMode ? demoGeneService : liveGeneService;
  if (route.kind === 'genes') { const result = await geneService.search(route.query.get('q') ?? ''); if (requestId !== latestRequestId) return; target.innerHTML = result.status === 'ok' ? renderSearchPage(result.data ?? [], route.query.get('q') ?? '', result.dataMode ?? 'live') : renderError(result.errorCode, route.query.get('q') ?? ''); bindGeneSearch(); return; }
  if (route.kind === 'variants') { const geneId = route.query.get('gene'); const query = route.query.get('q')?.trim() ?? ''; if (geneId) { const result = await geneService.getGene(geneId); if (requestId !== latestRequestId) return; if (result.status !== 'ok' || !result.data) { target.innerHTML = renderError(result.errorCode, geneId); return; } await renderVariantGene(target, requestId, route, result.data, demoMode); return; } if (query) { const variantQuery = /^(VCV|SCV|rs|DEMO-VAR)/i.test(query); if (variantQuery) { const variant = await (demoMode ? demoVariantService : liveVariantService).getVariant(query); if (variant.status === 'ok' && variant.data) { const gene = await (demoMode ? demoGeneService : liveGeneService).getGene(variant.data.geneId); if (gene.status === 'ok' && gene.data) { await renderVariantGene(target, requestId, route, gene.data, demoMode, variant.data); return; } } } const search = await geneService.search(query); const candidate = search.data?.find((item) => item.symbol.toLocaleLowerCase() === query.toLocaleLowerCase() || item.id.toLocaleLowerCase() === query.toLocaleLowerCase()) ?? (search.data?.length === 1 ? search.data[0] : undefined); if (candidate) { const gene = await geneService.getGene(candidate.id); if (gene.status === 'ok' && gene.data) { await renderVariantGene(target, requestId, route, gene.data, demoMode); return; } } if (requestId !== latestRequestId) return; target.innerHTML = renderVariantExplorer(undefined, [], '', '', demoMode ? 'demo' : 'live', query, true); bindVariantSearch(); return; } target.innerHTML = renderVariantExplorer(undefined, [], '', '', demoMode ? 'demo' : 'live'); bindVariantSearch(); return; }
  if (route.kind === 'literature') { const query = route.query.get('q') ?? ''; const result = await liveLiteratureService.searchPublications(query); if (requestId !== latestRequestId) return; target.innerHTML = renderLiteraturePage(result.data ?? [], query); bindLiteratureSearch(); return; }
  if (route.kind === 'lab') { target.innerHTML = renderLabPage(); bindLab(); return; }
  if (route.kind === 'assistant') { const query = route.query.get('q') ?? ''; if (!query) { target.innerHTML = renderAssistantPage(); bindAssistant(); return; } const result = await liveGeneService.getGene(query); if (requestId !== latestRequestId) return; target.innerHTML = renderAssistantPage(result.data, query); bindAssistant(); return; }
  if (route.kind === 'about') { target.innerHTML = renderAboutPage(); return; }
  if (route.kind === 'sources') { target.innerHTML = renderSourcesPage(); return; }
  if (route.kind === 'gene' && route.id) { const result = await geneService.getGene(route.id); if (requestId !== latestRequestId) return; if (result.status !== 'ok' || !result.data) { target.innerHTML = renderError(result.errorCode, route.id); return; } if (requestId !== latestRequestId) return; target.innerHTML = renderGeneDetails(result.data, result.dataMode ?? 'live'); return; }
  if (route.kind === 'variant' && route.id) { const variantServiceForRoute = demoMode ? demoVariantService : liveVariantService; const result = await variantServiceForRoute.getVariant(route.id); if (requestId !== latestRequestId) return; if (result.status !== 'ok' || !result.data) { target.innerHTML = renderError(result.errorCode, route.id); return; } const gene = demoMode ? await demoGeneService.getGene(result.data.geneId) : await liveGeneService.getGene(result.data.geneId); if (requestId !== latestRequestId) return; target.innerHTML = renderVariantDetails(result.data, gene.data, demoMode ? 'demo' : 'live'); }
};

const render = (): void => { const route = parseRoute(); const requestId = ++latestRequestId; renderShell(route); if (route.kind !== 'home' && route.kind !== 'planned') void loadContent(route, requestId); };
window.addEventListener('hashchange', render);
render();
