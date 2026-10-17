# Branding PNG optimization

Date: 2026-10-18

## Scope

- `asset-source/ui/branding/favicon-mique-logo.png` (1254×1254 PNG source of truth)
- `dist/assets/ui/branding/favicon-mique-logo.png` (64×64 deployed favicon)
- `dist/assets/ui/branding/app-icon-512.png`

The 1254 px favicon source remains unchanged at
`asset-source/ui/branding/favicon-mique-logo.png` (SHA-256:
`14064126d0441e8e430caf4c036283203907b6d7e62a79ca8916cd7a8379df75`). The
deployed favicon is a 64 px RGBA PNG generated from that source with Pillow's
high-quality LANCZOS RGBA resampling. This keeps transparent and partially
transparent pixels intact and makes the browser's favicon payload appropriately
small. `dist/index.html` continues to reference this deployed 64 px file.

The pre-optimization 512 px app icon did not have an `asset-source` copy, so it
was preserved unchanged at `asset-source/ui/branding/app-icon-512.png` before
its lossless optimization.

## Method

`scripts/optimize_branding_png_losslessly.py` parses and CRC-validates the 512
px PNG,
concatenates and decompresses its IDAT payload, then tries zlib levels 1–9 with
the default, filtered, RLE, and fixed strategies at memory level 9. It writes
the smallest result only when it is smaller than the original.

The selected 512 px setting was zlib level 9 with the filtered strategy. No
resizing, quantization, palette conversion, alpha cutoff, or pixel filter
rewrite was performed for that PWA icon. The favicon is deliberately different:
`scripts/resize_favicon.py` creates its 64 px deployment rendition with LANCZOS
RGBA resampling from the retained 1254 px source.

## Verification

- The 512 px icon has identical decompressed scanline data, decoded RGBA bytes,
  dimensions, and non-IDAT chunks before and after compression.
- The retained 1254 px favicon source has its original `caBX` ancillary chunk;
  its 64 px deployment rendition is a newly encoded PNG with checked RGBA
  transparency.
- Neither lossless-compression input contains `iCCP`, `sRGB`, `gAMA`, or
  `cHRM` chunks; therefore no color-management chunk was removed or changed.
- Full machine-readable results and SHA-256 hashes are in the adjacent JSON
  reports.

| Asset | Dimensions | Before | After | Saved | Reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| favicon source | 1254×1254 | 863,491 B | 863,491 B | 0 B | 0% |
| deployed favicon | 64×64 | 863,491 B source | 6,821 B | 856,670 B | 99.21% |
| app-icon-512 | 512×512 | 475,232 B | 460,136 B | 15,096 B | 3.18% |

The 64 px output's dimensions, source/destination hashes, RGBA mode, and
transparent/opaque/partial-alpha pixel checks are captured in
`favicon-64-report.json`. Manual checks at 64, 32, and 16 px confirmed that the
logo remains recognizable; the 16 px rendition necessarily resolves to its
central mark rather than its fine details.
