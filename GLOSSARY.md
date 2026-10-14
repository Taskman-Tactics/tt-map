# TT Map

Read-only map view of a Risk-inspired game board. Viewers observe Territories and Regions; capture and play happen outside this app.

## Language

**Territory**:
A closed area of the board that can be captured and interacted with in the game (outside this app). Territories form a partition of the playable board: they share edges with neighbors and their interiors do not overlap.
_Avoid_: Country, province, land, tile, border (as a separate entity)

**Region**:
A group of Territories that are geographically close on the board.
_Avoid_: Continent, zone, area

**Viewer**:
A person using this app to observe the current game state.
_Avoid_: Player, user (when meaning a game participant)

**Author**:
A person who draws and maintains Territory geometries for the board (outside the Viewer experience).
_Avoid_: Editor (as a person), cartographer, mapper
