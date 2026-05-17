# LibreTranslate local setup (EIP)

This project can run a local LibreTranslate provider and use it from EIP publish-time translation.

## One-time setup

From `eip-core` root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\libretranslate_local.ps1 -Action setup
```

Equivalent npm shortcut:

```powershell
cmd /c npm run lt:setup
```

What this does:
- creates Python virtualenv under `apps/libre translate/LibreTranslate-main/.venv`
- installs LibreTranslate from local source
- creates `db/api_keys.db` for provider API keys
- creates/reuses an API key
- writes translation provider env vars into `eip-core/.env`

## Start/stop/status/test

```powershell
# start local provider on 127.0.0.1:5000
powershell -ExecutionPolicy Bypass -File .\scripts\libretranslate_local.ps1 -Action start

# check health + supported languages
powershell -ExecutionPolicy Bypass -File .\scripts\libretranslate_local.ps1 -Action status

# send sample translation request using API key from .env
powershell -ExecutionPolicy Bypass -File .\scripts\libretranslate_local.ps1 -Action test

# stop provider
powershell -ExecutionPolicy Bypass -File .\scripts\libretranslate_local.ps1 -Action stop
```

Equivalent npm shortcuts:

```powershell
cmd /c npm run lt:start
cmd /c npm run lt:status
cmd /c npm run lt:test
cmd /c npm run lt:stop
```

## Required EIP restart

After setup or `.env` changes, restart the API service so `services/api` reloads translation env values.

## Switch to Google or OpenAI provider

If you don't want LibreTranslate, update `eip-core/.env` and restart API:

```dotenv
TRANSLATION_PROVIDER_ENABLED=true
TRANSLATION_PROVIDER_CODE=google
TRANSLATION_PROVIDER_BASE_URL=https://translation.googleapis.com
TRANSLATION_PROVIDER_API_KEY=<google-api-key>
```

or

```dotenv
TRANSLATION_PROVIDER_ENABLED=true
TRANSLATION_PROVIDER_CODE=openai
TRANSLATION_PROVIDER_BASE_URL=https://api.openai.com/v1
TRANSLATION_PROVIDER_API_KEY=<openai-api-key>
TRANSLATION_PROVIDER_MODEL=gpt-4.1-mini
```

For OpenAI, if `TRANSLATION_PROVIDER_API_KEY` is empty, backend also falls back to `OPENAI_API_KEY`.
