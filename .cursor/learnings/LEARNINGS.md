# Learnings

## 2026-10-14: MapLibre LngLat latitude must stay within ±90

**Action:** applied → `.cursor/rules/maplibre-board-coords.mdc`

MapLibre validates latitude to `[-90, 90]` when setting bounds/centers. Fictional board overlays cannot use raw pixel Y as latitude if the image is taller than 90 units. Scale pixel space into a valid lon/lat box (and document the scale for API GeoJSON) instead of assuming “any numbers work as lon/lat.”

## 2026-10-14: PowerShell git commit messages must not use bash HEREDOC EOF

**Action:** applied → `.cursor/rules/powershell-git-commits.mdc`

On Windows PowerShell, copying the bash `git commit -m "$(cat <<'EOF' ... EOF)"` pattern into a `@\" ... \"@` here-string leaves a literal `EOF` in the commit message. Use `git commit -m "one-line message"` or a PowerShell here-string whose content is only the message text.

## 2026-10-14: terra-draw rejects unclosed rings that MapLibre still paints

**Action:** applied → `.cursor/rules/terra-draw-authoring.mdc`

MapLibre GeoJSON sources often render Polygon rings even when first≠last. terra-draw `addFeatures` validates closed rings and silently drops failures unless you check the returned `StoreValidation[]`. When Author load looks flaky but the Viewer shows the same file, close rings on ingest/export and surface rejected reasons in UI status.

## 2026-10-14: terra-draw finish fires for edits; setMode clears selection

**Action:** applied → `.cursor/rules/terra-draw-authoring.mdc`

terra-draw’s `finish` event runs for draw *and* vertex edits (`dragCoordinate`, `insertMidpoint`, etc.). Calling `setMode('select')` on every finish restarts select mode and deselects the feature. Gate mode switches on `context.action === 'draw'`.

## 2026-10-14: basemap pixel snap must use Mercator UV, not LngLat/scale

**Action:** applied → `.cursor/rules/maplibre-board-coords.mdc`

MapLibre image sources interpolate texture UV across corners in Mercator space. For a LngLat-axis-aligned board, longitude stays linear but latitude warps — so `round(lngLat * 100) / 100` misses basemap texels by several pixels mid-board. Snap via MercatorCoordinate → image UV → integer px/py → back to LngLat.

## 2026-10-14: quantize Mercator snap to terra-draw coordinatePrecision

**Action:** applied → `.cursor/rules/maplibre-board-coords.mdc`

Mercator LngLat round-trips produce long floats (15+ decimals). terra-draw defaults to `coordinatePrecision: 9` and rejects “excessive precision,” so Author `addFeatures` silently drops Territories the Viewer still paints. After pixel snap, `Number(value.toFixed(9))` (and keep adapter precision in sync).

## 2026-10-14: calibrate board pixel snap against hand-placed references

**Action:** applied → `.cursor/rules/maplibre-board-coords.mdc`

Hand-placed Territories on the visible basemap grid land on integer Mercator image-UV corners (not linear `pixel/100` LngLat). Keep a frozen reference fixture and assert max snap error < 0.5 texels when changing snap math.

## 2026-10-14: board pixels should be linear in Web Mercator, not LngLat

**Action:** applied → `.cursor/rules/maplibre-board-coords.mdc`, ADR-0001

A “LngLat = pixel/N” box makes basemap rows warp under MapLibre’s Mercator image mapping. Lay the image on a linear `MercatorCoordinate` pixel grid, store WGS84 LngLat derived from that, and snap by rounding px/py. Migrate old data by preserving image UV.

## 2026-10-14: verify ng serve after FeatureCollection typing changes

**Action:** pending

`TerritoryCollection` features are GeoJSON `Feature` (`id?: string | number`), while our `TerritoryFeature` requires `id: string`. Unit tests that construct `TerritoryFeature` directly won’t catch assigning `collection.features` into a `Map<string, TerritoryFeature>`. After wiring origin/draft maps from FeatureCollections, confirm `ng serve` / the Angular compiler succeeds — Vitest alone is not enough.

## 2026-10-14: do not collinear-simplify on insertMidpoint finish

**Action:** applied → `.cursor/rules/terra-draw-authoring.mdc`

terra-draw `finish` also fires for `insertMidpoint`. A fresh midpoint lies on the edge (collinear with its neighbors) until the user drags it. Running shape-preserving collinear simplify on every finish deletes that vertex immediately — looks like “midpoint click does nothing.” Gate collinear simplify to `context.action === 'draw'` (and/or commit/export); keep snap-on-finish for edits.
