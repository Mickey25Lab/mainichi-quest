# Branding PNG lossless optimization

Date: 2026-10-18

## Scope

- `dist/assets/ui/branding/favicon-mique-logo.png`
- `dist/assets/ui/branding/app-icon-512.png`

The favicon source remains unchanged at
`asset-source/ui/branding/favicon-mique-logo.png`. The pre-optimization 512 px
app icon did not have an `asset-source` copy, so it was preserved unchanged at
`asset-source/ui/branding/app-icon-512.png` before optimization.

## Method

`scripts/optimize_branding_png_losslessly.py` parses and CRC-validates the PNG,
concatenates and decompresses its IDAT payload, then tries zlib levels 1–9 with
the default, filtered, RLE, and fixed strategies at memory level 9. It writes
the smallest result only when it is smaller than the original.

The selected setting for both files was zlib level 9 with the filtered
strategy. No resizing, quantization, palette conversion, alpha cutoff, or pixel
filter rewrite was performed.

## Verification

- Decompressed PNG scanline bytes are identical before and after.
- Pillow-decoded RGBA bytes and dimensions are identical before and after.
- Every non-IDAT chunk is preserved byte-for-byte and in the same order.
- The favicon retained its `caBX` ancillary chunk byte-for-byte.
- Neither input contains `iCCP`, `sRGB`, `gAMA`, or `cHRM` chunks; therefore no
  color-management chunk was removed or changed.
- Full machine-readable results and SHA-256 hashes are in the adjacent JSON
  reports.

| Asset | Dimensions | Before | After | Saved | Reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| favicon | 1254×1254 | 863,491 B | 807,135 B | 56,356 B | 6.53% |
| app-icon-512 | 512×512 | 475,232 B | 460,136 B | 15,096 B | 3.18% |
| Total | — | 1,338,723 B | 1,267,271 B | 71,452 B | 5.34% |
