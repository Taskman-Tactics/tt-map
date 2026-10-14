# Pixel-scaled board coordinates

The game board is a fictional plane, not Earth. We map `basemap.webp` (2048×1503) into MapLibre lon/lat by dividing pixel positions by 100, so the board occupies roughly `0…20.48` × `0…15.03`. That keeps latitude inside MapLibre’s required `[-90, 90]` range while staying linearly tied to the source image. Future Territory GeoJSON from the external API must use this same scaled space (`pixel / 100`).

Alternatives considered: raw pixel numbers as lon/lat (rejected — MapLibre throws on latitude outside ±90); a free-scaled “degree-like” box unrelated to pixels; and a real EPSG:3857 / COG pipeline from earlier GDAL experiments — deferred so step 1 stays a single image source with one shared board space.
