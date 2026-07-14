# EIP Dashboard Live Translation V1

EIP dashboard translation is owned by EIP, not by the browser page-translate widget.

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

The language switcher updates shared dashboard language state. The provider updates document `lang`/`dir`, translates engine props before component render, and runs a MutationObserver-backed live translation pass over rendered text and metadata attributes.

User-entered values, form field values, code blocks, scripts, SVGs, and elements marked with `data-eip-i18n="off"` or `translate="no"` are not rewritten.

## Google page translate

The legacy Google Website Translator widget is not embedded. It has been discontinued/restricted for general/commercial website use and is not a reliable product dependency for EIP. If automatic machine translation is required later, use a governed server-side provider integration such as Google Cloud Translation API or another approved translation provider, with caching and review workflow.
