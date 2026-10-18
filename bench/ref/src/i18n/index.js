'use strict';

const catalogs = {
  en: require('./messages/en'),
  de: require('./messages/de'),
};

// Replaces {placeholder} with params.placeholder; unknown placeholders are
// left as they are so a missing parameter is visible instead of silent.
function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

// Lookup order: requested language, then the default language, then the key
// itself. Returning the key keeps the UI usable while a translation is
// missing.
function createI18n({ defaultLanguage = 'en' } = {}) {
  if (!catalogs[defaultLanguage]) throw new Error(`No messages for default language "${defaultLanguage}"`);

  function resolveLanguage(language) {
    if (!language) return defaultLanguage;
    const base = String(language).toLowerCase().split(/[-_]/)[0];
    return catalogs[base] ? base : defaultLanguage;
  }

  function t(language, key, params) {
    const lang = resolveLanguage(language);
    const template = catalogs[lang][key] ?? catalogs[defaultLanguage][key] ?? key;
    return interpolate(template, params);
  }

  return {
    t,
    resolveLanguage,
    languages: Object.keys(catalogs),
  };
}

module.exports = { createI18n, interpolate };
