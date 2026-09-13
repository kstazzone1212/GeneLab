import en from './en.json';
import es from './es.json';

export type Locale = 'en' | 'es';
type TranslationKey = keyof typeof en;
const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, es };

let currentLocale: Locale = (localStorage.getItem('genelab-locale') as Locale) || 'en';

export const getLocale = (): Locale => currentLocale;

export const setLocale = (locale: Locale): void => {
  currentLocale = locale;
  localStorage.setItem('genelab-locale', locale);
  document.documentElement.lang = locale;
};

export const t = (key: TranslationKey): string => dictionaries[currentLocale][key] ?? dictionaries.en[key];