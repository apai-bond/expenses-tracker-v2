# Pocket Budget V32 — View-only mode and text formatting

The offline JavaScript spreadsheet opens in view-only mode. Tap **Edit** to enable changes. While view mode is active, mutating toolbar actions and formula entry are disabled. Selection, range selection, copy, focus mode and pinch zoom remain available.

New formatting tools:
- **Align** cycles Auto → Left → Center → Right for the selected cell/range.
- **Font size** opens a control for 10–28 px and supports reset to default.

Formatting is stored under `cellStyles` in the custom-sheet IndexedDB record and is included automatically in encrypted `.pbe` backups.
