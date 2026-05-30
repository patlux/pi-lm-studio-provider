# pi-lm-studio-provider

A [pi](https://pi.dev) extension that discovers local [LM Studio](https://lmstudio.ai) models and registers them as a Pi provider.

It talks to LM Studio's local API, builds Pi model definitions from the discovered chat models, and registers the provider as `lm-studio`.

## Install

This package is published on GitHub only.

```sh
pi install git:github.com/patlux/pi-lm-studio-provider@v0.1.1
```

Then reload pi:

```txt
/reload
```

## Usage

Start LM Studio's local server:

```sh
lms server start
```

Load a model in LM Studio, then start or reload Pi. Models are registered under:

```txt
lm-studio/<model-id>
```

Select a model with Pi's normal model picker, or directly:

```sh
pi --model lm-studio/<model-id>
```

To refresh and inspect the discovered models from inside Pi, run:

```txt
/lm-studio-models
```

The command shows:

- discovery endpoint used
- number of chat models found
- number of loaded models
- context window
- quantization
- vision/tool/reasoning capabilities when reported by LM Studio

## Configuration

By default the extension connects to:

```txt
http://127.0.0.1:1234
```

Environment variables:

| Variable | Purpose |
| --- | --- |
| `PI_LM_STUDIO_BASE_URL` | Preferred LM Studio base URL override. |
| `LM_STUDIO_BASE_URL` | Secondary LM Studio base URL override. |
| `PI_LM_STUDIO_TIMEOUT_MS` | Discovery request timeout in milliseconds. Defaults to `1500`. |
| `LM_API_TOKEN` | Optional bearer token for LM Studio. |

The base URL can point at the root or at a known API suffix. These are normalized to the root URL:

```txt
http://127.0.0.1:1234
http://127.0.0.1:1234/v1
http://127.0.0.1:1234/api/v0
http://127.0.0.1:1234/api/v1
```

## Discovery order

The extension tries the available LM Studio endpoints in order:

```txt
/api/v1/models
/api/v0/models
/v1/models
```

It uses the first endpoint that returns at least one chat model.

## Notes

- Embedding models are ignored.
- Vision models are registered with `text` and `image` input support.
- Local model costs are set to zero.
- Max output tokens are capped at half the context window, up to `16384`.
- Use `/reload` after loading, unloading, or changing models in LM Studio.
- Extensions run with local user permissions. Review extensions before installing them.

## Development

```sh
npm ci
npm run check
```

The package uses TypeScript source directly. Pi loads `.ts` extensions without a build step.

## Release

GitHub-only release flow:

```sh
npm version patch --no-git-tag-version
git commit -am "Release vX.Y.Z"
git tag -a vX.Y.Z -m "pi-lm-studio-provider vX.Y.Z"
git push origin main vX.Y.Z
```

Install the pinned tag with:

```sh
pi install git:github.com/patlux/pi-lm-studio-provider@vX.Y.Z
```

## License

MIT
