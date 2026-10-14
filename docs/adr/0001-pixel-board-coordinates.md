# Web Mercator–linear board pixels

The game board is a fictional plane, not Earth. We georeference `basemap.webp` (2048×1503) by placing its pixels on a **linear Web Mercator** grid (MapLibre `MercatorCoordinate`), then storing positions as WGS84 LngLat for GeoJSON / the API. Equal pixel steps are equal Mercator steps, so basemap texels stay square in the projection MapLibre paints and Author snapping is “round to integer px/py” on that plane.

The board is centered on the Mercator world midpoint with `BOARD_MERCATOR_UNITS_PER_PIXEL = 1/256/2048` (board width ≈ one z=8 tile). Image source corners are the LngLat forms of pixel corners `(0,0)…(2048,1503)` (top-left origin, y south).

Supersedes the earlier “LngLat = pixel/100” box (`0…20.48` × `0…15.03`), which made rows warp under Mercator so visual pixels ≠ `round(lngLat*100)/100`. Existing Territory data migrates by preserving image UV under the old corners, then re-expressing those UVs in the new Mercator-linear space.

Alternatives considered: raw pixel numbers as lon/lat (rejected — MapLibre throws on latitude outside ±90); keeping the LngLat box and only fixing snap math (works but leaves storage/display disagreeing); a full EPSG:3857 / COG pipeline — still deferred; the in-app MercatorCoordinate grid is enough for a single image source.
