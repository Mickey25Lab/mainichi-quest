# Asset source of truth

`asset-source/` holds the editable production originals. It is not served by the application.

## Layout

- `collection/`: vehicle, evolution, equipment, medal, title, background, and completion artwork. The existing numbered category layout is retained.
- `common/`: artwork shared by the top screen, reward flow, speech bubbles, branding, and legacy start/finish backgrounds.

## Publishing policy

`dist/` contains only browser-delivered assets. Copy or export from `asset-source/` when a production asset changes; do not point application code at `asset-source/`.

PNG production originals and required PWA icons remain PNG. Browser-delivered game artwork remains WebP where that is the existing runtime format.

## Current common source mappings

| Source of truth | Runtime location |
| --- | --- |
| `common/top/` | `dist/assets/top/` |
| `common/reward_popup/` | `dist/assets/reward_popup/` |
| `common/speech_bubble/` | `dist/answer/speech_bubble/` |
| `common/branding/app_icon/` | `dist/assets/app-icon-192.png`, `dist/assets/app-icon-512.png` |
| `common/branding/favicon/` | `dist/assets/favicon-mique-logo.png` |
| `common/branding/apple_touch_icon/` | `dist/assets/apple-touch-icon.png` |

`common/start_finish_background/` preserves the legacy production originals. These files are not part of the current runtime bundle.
