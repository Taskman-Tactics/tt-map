# Learnings

## 2026-10-14: MapLibre LngLat latitude must stay within ±90

**Action:** applied → `.cursor/rules/maplibre-board-coords.mdc`

MapLibre validates latitude to `[-90, 90]` when setting bounds/centers. Fictional board overlays cannot use raw pixel Y as latitude if the image is taller than 90 units. Scale pixel space into a valid lon/lat box (and document the scale for API GeoJSON) instead of assuming “any numbers work as lon/lat.”

## 2026-10-14: PowerShell git commit messages must not use bash HEREDOC EOF

**Action:** pending

On Windows PowerShell, copying the bash `git commit -m "$(cat <<'EOF' ... EOF)"` pattern into a `@\" ... \"@` here-string leaves a literal `EOF` in the commit message. Use `git commit -m "one-line message"` or a PowerShell here-string whose content is only the message text.
