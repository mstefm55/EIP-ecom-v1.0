# EIP Dashboard Live Translation V1

EIP dashboard translation is owned by EIP, not by the browser page-translate widget.

The runtime source of truth is a UI language pack, not component-local strings. The bundled pack in the dashboard app is only a seed/fallback so the shell can still boot before tenant metadata is available.

## Scope

The dashboard language layer covers:

- shell/header controls;
- sidebar/menu labels;
- engine-rendered surface props such as titles, subtitles, labels, tabs, buttons, and helper text;
- rendered DOM text from large panel components;
- metadata attributes such as `title`, `aria-label`, `aria-description`, `placeholder`, `alt`, `data-title`, and `data-tooltip`.

The supported language set is:

- English
- Russian
- French
- Kyrgyz
- Spanish
- German

## Runtime behavior

The language switcher updates shared dashboard language state. The provider first loads a language pack from metadata:

- authenticated dashboard: `GET /api/eip/ui/language-pack`;
- public/auth surfaces: `GET /api/public/ui/language-pack`;
- tenant override storage: `eip_core.tenant_module_setting` where `module = 'ui'` and `code = 'language_pack'`.

The pack shape is:

```json
{
  "id": "eip-dashboard-language-pack",
  "version": "eip-dashboard-i18n-v1",
  "source_locale": "en",
  "supported_locales": ["en", "ru", "fr", "ky", "es", "de"],
  "component_metadata": {},
  "translations": {}
}
```

The provider merges tenant metadata over the bundled seed pack, updates document `lang`/`dir`, translates engine props before component render, and runs a MutationObserver-backed live translation pass over rendered text and metadata attributes.

The MutationObserver pass is a compatibility bridge for older React panels that still render literal labels. New EIP V1 UI should continue moving labels, page structure, component metadata, and translations into governed metadata records rather than duplicating strings in component code.

User-entered values, form field values, code blocks, scripts, SVGs, and elements marked with `data-eip-i18n="off"` or `translate="no"` are not rewritten.

## Google page translate

The legacy Google Website Translator widget is not embedded. It has been discontinued/restricted for general/commercial website use and is not a reliable product dependency for EIP. If automatic machine translation is required later, use a governed server-side provider integration such as Google Cloud Translation API or another approved translation provider, with caching, review workflow, and persisted language-pack output.
