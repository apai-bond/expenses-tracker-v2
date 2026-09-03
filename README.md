# Pocket Budget - Version 31 Advanced Offline Spreadsheet

Version 31 branches from the offline JavaScript spreadsheet build and keeps all Pocket Budget financial data in local IndexedDB. Encrypted `.pbe` backup files remain supported.

## Spreadsheet improvements

- Focus mode is optimized for landscape. The sheet title/description and bottom status text disappear in landscape focus mode so the grid gets more screen space.
- The Focus/Exit control is now inside the spreadsheet icon toolbar.
- Multiple-cell rectangular selection is supported. Tap **Range**, then tap the opposite corner. On a computer, Shift+click and Shift+Arrow extend the selection.
- Range operations work with Copy, Clear, RM format, and Merge.
- Two-finger pinch zoom works directly on the spreadsheet from 65% to 160%. The zoom preference is remembered locally.
- Existing formulas, merged cells, row/column sizing, dashboard links, copy/paste, undo/redo, and encrypted backups remain supported.

## Local testing

Run:

```powershell
python start_server.py
```

Open:

```text
http://localhost:8000/?v=31&view=sheet
```

Force-refresh once after replacing an older build.

## GitHub Pages

Upload the project files to the repository root and publish from `main` / `/ (root)`. The service-worker cache is:

```text
pocket-budget-v31-advanced-offline-sheet
```

## Data

The live database remains local IndexedDB and is not encrypted at rest. Exported `.pbe` backups remain password-encrypted. Clearing Safari/Chrome site data can remove IndexedDB, so keep regular `.pbe` backups.
