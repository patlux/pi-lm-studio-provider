# pi-lm-studio-provider

Register local LM Studio models as a Pi provider after discovering LM Studio's local API.

## Install

```bash
pi install git:github.com/patlux/pi-lm-studio-provider@v0.1.0
```

Then reload Pi:

```text
/reload
```

## Pi manifest

```json
{
  "extensions": ["./index.js"]
}
```

The extension discovers LM Studio at `PI_LM_STUDIO_BASE_URL`, `LM_STUDIO_BASE_URL`, or `http://127.0.0.1:1234`, registers provider `lm-studio`, and adds `/lm-studio-models` to refresh and show local models.
