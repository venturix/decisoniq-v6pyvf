import i18next from 'i18next'; // v23.0.0
import LanguageDetector from 'i18next-browser-languagedetector'; // v7.0.0
import HttpBackend from 'i18next-http-backend'; // v2.0.0
import dayjs from 'dayjs'; // v1.11.0

// Import default translation files
import common from '../i18n/en/common.json';
import customer from '../i18n/en/customer.json';
import dashboard from '../i18n/en/dashboard.json';

// Define supported languages and configurations
export const SUPPORTED_LANGUAGES = [
  'en', // English
  'es', // Spanish
  'fr', // French
  'de', // German
  'it', // Italian
  'pt', // Portuguese
  'ja', // Japanese
  'ko', // Korean
  'zh', // Chinese
  'ar', // Arabic
] as const;

export const DEFAULT_LANGUAGE = 'en';
export const RTL_LANGUAGES = ['ar', 'he'] as const;

// Enterprise-grade i18n configuration
export const i18nConfig = {
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: 'common',
  ns: ['common', 'customer', 'dashboard', 'playbook', 'report'],
  
  // Advanced interpolation settings
  interpolation: {
    escapeValue: true,
    format: (value, format, lng) => {
      if (format === 'date') {
        return dayjs(value).locale(lng).format('YYYY-MM-DD');
      }
      if (format === 'currency') {
        return new Intl.NumberFormat(lng, {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      }
      return value;
    },
    formatSeparator: ',',
    skipOnVariables: false,
  },

  // Advanced language detection
  detection: {
    order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
    lookupQuerystring: 'lng',
    lookupLocalStorage: 'i18nextLng',
    caches: ['localStorage'],
    cookieMinutes: 43200, // 30 days
  },

  // Chunked loading configuration
  backend: {
    loadPath: '/i18n/{{lng}}/{{ns}}.json',
    allowMultiLoading: true,
    crossDomain: false,
    withCredentials: true,
    overrideMimeType: false,
    requestOptions: {
      cache: 'default',
      mode: 'cors',
    },
  },

  // React integration settings
  react: {
    useSuspense: true,
    bindI18n: 'languageChanged loaded',
    bindI18nStore: 'added removed',
    transEmptyNodeValue: '',
    transSupportBasicHtmlNodes: true,
    transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
  },

  // Enterprise features
  saveMissing: true,
  saveMissingTo: 'fallback',
  missingKeyHandler: (lng, ns, key) => {
    console.warn(`Missing translation key: ${key} in namespace: ${ns} for language: ${lng}`);
  },
  parseMissingKeyHandler: true,
  appendNamespaceToMissingKey: true,
  missingInterpolationHandler: (text, value) => {
    console.warn(`Missing interpolation value for text: ${text}, value: ${value}`);
    return value;
  },

  // Performance optimization
  load: 'currentOnly',
  partialBundledLanguages: true,
  maxParallelReads: 6,
};

// Initialize i18next with enterprise features
export const initializeI18n = async (): Promise<void> => {
  await i18next
    .use(HttpBackend)
    .use(LanguageDetector)
    .init({
      ...i18nConfig,
      resources: {
        en: {
          common,
          customer,
          dashboard,
        },
      },
      preload: [DEFAULT_LANGUAGE],
    });

  // Set up RTL detection
  const isRTL = RTL_LANGUAGES.includes(i18next.language as typeof RTL_LANGUAGES[number]);
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = i18next.language;

  // Set up language change handler
  i18next.on('languageChanged', (lng) => {
    const newIsRTL = RTL_LANGUAGES.includes(lng as typeof RTL_LANGUAGES[number]);
    document.documentElement.dir = newIsRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  });
};

export default i18next;