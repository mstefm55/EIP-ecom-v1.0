import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  DEFAULT_LANGUAGE_OPTIONS,
  LANGUAGE_COMPONENT_COPY,
  LANGUAGE_LIBRARY_VERSION,
  REQUIRED_LANGUAGE_CODES,
  UI_COMPONENT_LANGUAGE_METADATA,
  buildLocalizedCopy,
} from "../src/i18n/languageLibrary.js";

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("Samara language library exposes required locales and component metadata", () => {
  assert.equal(LANGUAGE_LIBRARY_VERSION, "samara-ui-i18n-v1");
  assert.deepEqual(REQUIRED_LANGUAGE_CODES, ["en", "ru", "fr", "ky", "es", "de"]);
  assert.deepEqual(DEFAULT_LANGUAGE_OPTIONS.map((item) => item.code), REQUIRED_LANGUAGE_CODES);

  for (const componentKey of ["nav", "hero", "cart", "auth", "account", "modals.subscribe"]) {
    assert.deepEqual(UI_COMPONENT_LANGUAGE_METADATA[componentKey].locales, REQUIRED_LANGUAGE_CODES);
    assert.match(UI_COMPONENT_LANGUAGE_METADATA[componentKey].version, /\.i18n\.v1$/);
  }
});

test("Samara language library provides UI copy for Russian, French, Kyrgyz, Spanish, and German", () => {
  const copy = buildLocalizedCopy({ en: LANGUAGE_COMPONENT_COPY.en });
  assert.equal(copy.ru.nav.language, "Язык");
  assert.equal(copy.fr.nav.language, "Langue");
  assert.equal(copy.ky.nav.language, "Тил");
  assert.equal(copy.es.nav.language, "Idioma");
  assert.equal(copy.de.nav.language, "Sprache");
  assert.equal(copy.de.hero.shop, "Schnittmuster kaufen");
});

test("Samara header renders from direct language switcher state", () => {
  assert.match(appSource, /languageValue=\{language\}/);
  assert.match(appSource, /languageOptions=\{languageOptions\}/);
  assert.match(appSource, /onLanguageChange=\{handleLanguageChange\}/);
  assert.match(appSource, /const t = useTranslator\(language\)/);
  assert.match(appSource, /document\.documentElement\.lang = normalizeLocaleCode\(language\) \|\| "en"/);
  assert.match(appSource, /languageManuallySelectedRef\.current = true/);
});
