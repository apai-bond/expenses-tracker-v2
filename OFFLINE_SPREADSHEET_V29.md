# Version 29 - Offline JavaScript Spreadsheet

Version 29 replaces the previous input-heavy Custom Sheet interface with a phone-friendly JavaScript spreadsheet while keeping the same IndexedDB storage.

## Data and privacy

- Spreadsheet data stays in the `customSheets` IndexedDB object store.
- No Google Sheets, Microsoft Excel, OneDrive, or cloud spreadsheet is embedded.
- Existing Version 28 cells, formulas, formats, sizes, merges, and dashboard links remain compatible.
- The spreadsheet remains part of Pocket Budget encrypted `.pbe` export and import.
- Live IndexedDB data is local but is not encrypted; the exported `.pbe` file is password-encrypted.

## User interface

- Single tap selects a cell without immediately opening the phone keyboard.
- Tap **Edit**, double-tap a cell, or tap the formula bar to edit.
- **Focus mode** hides the normal app header and bottom navigation so the grid uses the full phone screen.
- The compact toolbar scrolls horizontally on narrow screens.
- The selected cell, workbook size, link count, and save state remain visible.
- The app supports portrait and landscape orientation.

## Spreadsheet tools

- Add rows and columns up to 120 rows and 52 columns (A-AZ).
- RM number formatting.
- Basic formulas and functions.
- Merge and unmerge cells.
- Adjustable row heights and column widths.
- Home dashboard links.
- CSV export.
- Copy and paste, including tab-separated multi-cell content.
- Session undo and redo.
- Keyboard navigation on a computer.

## Existing formulas

```text
=A1+B1
=A1-B1
=A1*B1
=A1/B1
=SUM(A1:A10)
=AVG(A1:A10)
=MIN(A1:A10)
=MAX(A1:A10)
=COUNT(A1:A10)
=TOTALINCOME()
=EXPENSES()
=SAVED()
=AVAILABLE()
```

## Files changed

```text
index.html
styles.css
app.js
db.js
manifest.webmanifest
service-worker.js
README.md
GITHUB_SETUP.md
```
