import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  DEFAULT_EIP_LANGUAGE_PACK,
  EIP_LANGUAGE_LIBRARY_VERSION,
  EIP_LANGUAGE_OPTIONS,
  EIP_REQUIRED_LANGUAGE_CODES,
  EIP_UI_COMPONENT_LANGUAGE_METADATA,
  translateEipText,
} from "../src/i18n/eipLanguageLibrary.js";

const mainSource = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const rendererSource = fs.readFileSync(new URL("../src/engine/renderer.jsx", import.meta.url), "utf8");
const adminShellSource = fs.readFileSync(new URL("../src/components/admin/AdminShell.jsx", import.meta.url), "utf8");
const userShellSource = fs.readFileSync(new URL("../src/components/user/UserShell.jsx", import.meta.url), "utf8");
const authShellSource = fs.readFileSync(new URL("../src/components/auth/AuthShell.jsx", import.meta.url), "utf8");
const sidebarSource = fs.readFileSync(new URL("../src/components/engine/SidebarNav.jsx", import.meta.url), "utf8");

test("EIP dashboard language library exposes required language metadata", () => {
  assert.equal(EIP_LANGUAGE_LIBRARY_VERSION, "eip-dashboard-i18n-v1");
  assert.deepEqual(EIP_REQUIRED_LANGUAGE_CODES, ["en", "ru", "fr", "ky", "es", "de"]);
  assert.deepEqual(EIP_LANGUAGE_OPTIONS.map((item) => item.code), EIP_REQUIRED_LANGUAGE_CODES);
  assert.equal(DEFAULT_EIP_LANGUAGE_PACK.source, "bundled_seed_metadata");
  assert.equal(DEFAULT_EIP_LANGUAGE_PACK.version, EIP_LANGUAGE_LIBRARY_VERSION);
  assert.deepEqual(DEFAULT_EIP_LANGUAGE_PACK.supported_locales, EIP_REQUIRED_LANGUAGE_CODES);
  assert.equal(DEFAULT_EIP_LANGUAGE_PACK.component_metadata, EIP_UI_COMPONENT_LANGUAGE_METADATA);
  assert.equal(DEFAULT_EIP_LANGUAGE_PACK.translations.de.Language, "Sprache");
  for (const componentKey of ["shell", "sidebar", "auth", "admin", "tenantDashboard", "contentStudio", "commerce"]) {
    assert.deepEqual(EIP_UI_COMPONENT_LANGUAGE_METADATA[componentKey].locales, EIP_REQUIRED_LANGUAGE_CODES);
    assert.match(EIP_UI_COMPONENT_LANGUAGE_METADATA[componentKey].version, /\.i18n\.v1$/);
  }
});

test("EIP dashboard language library translates core shell labels", () => {
  assert.equal(translateEipText("Language", "ru"), "Язык");
  assert.equal(translateEipText("Language", "fr"), "Langue");
  assert.equal(translateEipText("Language", "ky"), "Тил");
  assert.equal(translateEipText("Language", "es"), "Idioma");
  assert.equal(translateEipText("Language", "de"), "Sprache");
  assert.equal(translateEipText("Content Studio Enhanced", "de"), "Erweitertes Content Studio");
});

test("EIP dashboard translations are read from a metadata language pack", () => {
  const tenantLanguagePack = {
    ...DEFAULT_EIP_LANGUAGE_PACK,
    source: "tenant_module_setting",
    translations: {
      ...DEFAULT_EIP_LANGUAGE_PACK.translations,
      de: {
        ...DEFAULT_EIP_LANGUAGE_PACK.translations.de,
        "Content Studio Enhanced": "Tenant Studio DE",
      },
    },
  };
  assert.equal(translateEipText("Content Studio Enhanced", "de", tenantLanguagePack), "Tenant Studio DE");
  assert.equal(translateEipText("Language", "de", tenantLanguagePack), "Sprache");
});

test("EIP dashboard language pack covers Product Studio UI labels and templates", () => {
  assert.equal(translateEipText("Library", "fr"), "Bibliothèque");
  assert.equal(translateEipText("Selected product", "fr"), "Produit sélectionné");
  assert.equal(translateEipText("Buyer preview", "fr"), "Aperçu acheteur");
  assert.equal(translateEipText("Supplier code", "fr"), "Code fournisseur");
  assert.equal(translateEipText("Translation service offline.", "fr"), "Service de traduction hors ligne.");
  assert.equal(translateEipText("Showing 1-3 of 3", "fr"), "Affichage 1-3 sur 3");
  assert.equal(translateEipText("New product", "fr"), "New product");
});

test("EIP dashboard wraps app in language provider and exposes switchers in all shells", () => {
  assert.match(mainSource, /<EipLanguageProvider>/);
  assert.match(adminShellSource, /<EipLanguageSwitcher compact \/>/);
  assert.match(userShellSource, /<EipLanguageSwitcher compact \/>/);
  assert.match(authShellSource, /<EipLanguageSwitcher compact \/>/);
  assert.match(sidebarSource, /const \{ t \} = useEipLanguage\(\)/);
});

test("EIP engine renderer translates static UI props live", () => {
  assert.match(rendererSource, /useEipLanguage/);
  assert.match(rendererSource, /translateUiProps/);
  assert.match(rendererSource, /ctx, i18n/);
});

test("EIP live translation covers rendered text and metadata attributes", () => {
  const contextSource = fs.readFileSync(new URL("../src/i18n/EipLanguageContext.jsx", import.meta.url), "utf8");
  assert.match(contextSource, /languagePack/);
  assert.match(contextSource, /\/api\/eip\/ui\/language-pack/);
  assert.match(contextSource, /\/api\/public\/ui\/language-pack/);
  assert.match(contextSource, /mergeLanguagePack/);
  assert.match(contextSource, /MutationObserver/);
  assert.match(contextSource, /TRANSLATABLE_ATTRIBUTES/);
  assert.match(contextSource, /"placeholder"/);
  assert.match(contextSource, /"aria-label"/);
  assert.match(contextSource, /"title"/);
  assert.match(contextSource, /"alt"/);
  assert.match(contextSource, /translatedTextMutationsRef/);
  assert.match(contextSource, /data-eip-i18n='off'/);
});
