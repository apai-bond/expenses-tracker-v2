# Version 25 - Monday Weekly Backup Reminder

## Behavior

The app calculates the Monday date for the current local week.

- If no backup has been created for that Monday-to-Sunday week, the popup appears when the app opens.
- If the app was not opened on Monday, the popup still appears the next time it is opened later in the week.
- **Create backup now** generates the normal Pocket Budget JSON backup and marks the current week complete.
- **Remind me tomorrow** closes the popup and postpones it until the next local calendar day.
- A backup created manually from **Setup > Local data** also completes the reminder for the current week.
- On the next Monday, a new weekly reminder becomes due.

## Stored reminder information

The following reminder values are stored in browser `localStorage`:

```text
pocket-budget-last-backup-at
pocket-budget-backup-completed-week
pocket-budget-backup-snooze-until
```

The financial records and spreadsheet remain in IndexedDB as before.

## Important limitation

The popup can only run when the web app is opened or resumed. An iPhone PWA cannot silently create a file while fully closed or silently choose a destination # Version 23 - Spreadsheet Information

The long spreadsheet help paragraph was replaced by a **Spreadsheet Information** button.

When opened, the popup shows:

- Current maximum sheet size: 120 rows and 52 columns (A-AZ)
- Basic arithmetic examples
- SUM, AVG, MIN, MAX and COUNT examples
- Home dashboard formulas
- RM formatting instructions
- Merge/unmerge instructions
- Cell sizing instructions
- Formula-bar editing information
- Dashboard-link behavior

The maximum row limit message was also corrected. Pressing **Add row** at row 120 now shows `Maximum 120 rows reached.` instead of incorrectly saying a row was added.
in the Files app.
This version exports a readable JSON backup. It does not yet encrypt the exported file.


Pocket Budget V24 - Spreadsheet Information position
The Spreadsheet Information button is now the first control inside the Custom Sheet panel, immediately above Dashboard link.
No spreadsheet data, formulas, linked cells, transactions, or settings are changed.
Pocket Budget V22 - Compact spreadsheet cells
The Custom Sheet cell-size controls now allow smaller dimensions while keeping cell contents vertically aligned.
Minimum column width: 48 px (previously 72 px)
Minimum row height: 32 px (previously 44 px)
Slider step: 2 px for finer adjustment
Default sizes are unchanged, so existing sheets keep their current layout
Cell text remains vertically centred in normal, RM-formatted, linked, formula, and merged cells
Existing saved column widths and row heights remain compatible.

Pocket Budget V21 — More spreadsheet columns
Previous maximum: 18 columns (A-R).
New maximum: 52 columns (A-AZ).
Add column now reports the new column letter.
The spreadsheet automatically scrolls to the new column after it is added.
When AZ is reached, the app shows a clear maximum-columns message.
Existing sheet data and other Pocket Budget records are unchanged.

Pocket Budget V20 - Spreadsheet toolbar position
The Quick table heading and spreadsheet action buttons have been moved below the Dashboard link, formula bar, and formula help. They now sit immediately above the spreadsheet grid.
No spreadsheet data, formulas, links, merged cells, or finance records are changed.

# Pocket Budget Version 19 — RM cell format

## New custom-sheet option

Select any normal spreadsheet cell and tap **RM format**. A stored value such as `300` is displayed as `RM 300.00`, while the raw numeric value remains available to formulas such as `=A1+A2` or `=SUM(A1:A10)`.

Tap **Remove RM** to return the selected cell to plain-number display. Formula cells continue to use RM formatting by default for backward compatibility, but can now also be switched to plain-number display. Dashboard-linked cells remain RM formatted automatically.

The chosen cell formats are saved in IndexedDB and included in JSON backups. The calculation parser also accepts values manually entered with an `RM` or `MYR` prefix.

# Pocket Budget Version 18

The Custom Sheet dashboard-link dropdown now supports all four Home summary values:

- Total income
- Expenses
- Saved
- Available balance

Choose a value, enter a target cell such as `A1`, and select **Link value**. Linked values remain formatted as Malaysian Ringgit and update automatically when the current salary cycle changes.

Direct formulas are also available:

```text
=TOTALINCOME()
=EXPENSES()
=SAVED()
=AVAILABLE()
```

# Pocket Budget Version 17

## Spreadsheet display changes

- Linked Available Balance cells show only the formatted amount.
- Formula cells show only the calculated value after entry.
- Calculated values display as Malaysian Ringgit with two decimal places.
- The original formula is retained and can be edited from the formula bar when the cell is selected.

Examples:

- `=C5+C6` displays `RM 700.00` in the cell.
- `=SUM(C5:C6)` displays `RM 700.00` in the cell.
- A linked Available Balance cell displays `RM 3,949.20` only.


# Pocket Budget V16 - Dashboard value links

The Custom Sheet can now display the current budget's **Available balance** in any cell.

## Use

1. Open **Sheet**.
2. In **Dashboard link**, choose **Available balance**.
3. Enter a target cell such as `A10`.
4. Tap **Link value**.

The linked cell updates automatically whenever the selected budget month, salary, saving entries, or expense transactions change. Use **Refresh** for an immediate manual recalculation and **Unlink cell** to return it to a normal editable cell.

You can also type `=AVAILABLE()` directly in a normal formula cell. Linked cells are saved in IndexedDB and included in JSON backups.


Version 15 - Merged cells
How to merge
Open Sheet.
Tap the first cell of the range.
Tap Merge cells.
Tap the opposite corner cell.
The rectangular range is merged and the value/formula from the top-left cell is retained. If other cells contain data, the app asks for confirmation before clearing them.
How to unmerge
Tap the merged cell and then tap Unmerge. The top-left value remains and the other cells become empty editable cells.
Merged ranges are saved locally in IndexedDB and are included in the JSON backup. CSV exports place the merged value in the top-left position and leave covered positions blank.


# Pocket Budget V14 - Sheet Cell Count Removed

The Custom Sheet heading no longer displays the row-by-column badge such as `20 x 6`.

No spreadsheet cells, row sizes, column sizes, formulas, transactions, or other IndexedDB data are changed.

Cache name: `pocket-budget-v14-cell-count-removed`.


# Pocket Budget Version 13

## Changes

- Moved the salary-cycle summary card to **Setup** only.
- Vertically centered spreadsheet row labels and empty cell inputs.
- Empty formula-result space no longer offsets normal cell text.
- Hidden spreadsheet drag-guide lines on iPhone and other touch devices.
- Desktop mouse resizing remains available.

## Cache

`pocket-budget-v13-layout-cleanup`


Pocket Budget V12 - Adjustable Sheet Rows and Columns
The Custom Sheet now supports saved row heights and column widths.
iPhone and touch controls
Open Sheet.
Tap the cell in the row and column you want to change.
Tap Cell size.
Move the Column width or Row height slider.
The selected sizes are saved automatically in IndexedDB.
Computer controls
You may use the same Cell size panel, or drag:
the right edge of a column heading to change that column width;
the bottom edge of a row number to change that row height.
Additional actions
Width to all applies the selected column's width to all columns.
Height to all applies the selected row's height to all rows.
Reset selected restores the selected row and column to the default size.
Reset all sizes restores every row and column to the default size.
The size settings are included in the normal JSON backup and restore process.


# Pocket Budget Version 11 - Custom Sheet

Version 11 adds a new bottom navigation tab named **Sheet**.

Use it as a free spreadsheet-style record area for anything that does not belong in the monthly expense transaction records.

## Main features

- One local custom sheet stored in IndexedDB
- Editable cells
- Add row
- Add column
- Header row on/off
- Formula bar
- Formula cells
- Export CSV
- Clear sheet only

## Supported formulas

Type formulas directly into any cell or into the formula bar after selecting a cell.

Examples:

```text
=SUM(B2:B10)
=AVG(C2:C8)
=MIN(B2:B10)
=MAX(B2:B10)
=COUNT(A2:A20)
=A2+B2
=A2*B2
```

Formula result is shown under the formula in the same cell.

## Notes

- The custom sheet is independent from salary-cycle expenses.
- The sheet is included in JSON backup/export.
- The sheet is cleared when using Delete all test data.
- CSV export saves calculated formula results instead of the formula text.


# Pocket Budget V10 - iPhone Date Picker Fix

This update fixes the iPhone Safari date field extending beyond the transaction form.

Changes:

- Constrains date controls to the width of their form field.
- Resets Safari's intrinsic date-input width.
- Keeps the normal iPhone date picker available when the field is tapped.
- Left-aligns the displayed date consistently.
- Applies the same fix to the transaction date and salary-cycle start date.
- Updates the service-worker cache to `pocket-budget-v10-date-picker-fit`.

Existing local records and IndexedDB data are not changed.


Pocket Budget V9 - iPhone Layout Fix
This update improves the form layout on iPhone Safari and the installed Home Screen web app.
Date and Category are stacked vertically on screens up to 480px wide.
Native Safari date/select controls are constrained to the card width.
Input text is at least 16px to prevent Safari focus zoom.
The header becomes one column on mobile.
Home Screen mode receives extra safe-area spacing below the Dynamic Island.
Existing IndexedDB records are not changed.


# Salary Cycle Update - Version 8

## How the budget month works

The selected budget month is now based on the salary cycle instead of the calendar month.

Example for the August 2026 budget:

- Normal salary date: 27 July 2026
- August budget starts: 27 July 2026
- August budget ends: 26 August 2026
- A transaction dated 27 July is included in August, not July.

## Weekend adjustment

The app uses the 27th of the previous month as the automatic cycle start.

- If the 27th is Monday to Friday, it uses the 27th.
- If the 27th is Saturday, it moves to Friday the 26th.
- If the 27th is Sunday, it moves to Friday the 25th.

## Public holidays or other early payments

The app is offline and does not download a public-holiday calendar. In Monthly Setup, change **Salary received / cycle start date** to the actual earlier salary date.

The selected month ends one day before the next month's actual salary date. For example, if the September salary is received on 26 August, the August budget ends on 25 August.

## Existing records

Existing transactions do not need to be deleted or migrated. Version 8 reads transactions by their actual date and places them inside the selected salary-cycle date range.

## Updated files

- `cycle.js` - salary-cycle date rules
- `app.js` - interface and transaction-cycle handling
- `db.js` - date-range query for IndexedDB
- `calculations.py` - average daily spending by elapsed cycle days
- `index.html` - cycle display and salary-date setup
- `styles.css` - cycle interface styling
- `service-worker.js` - Version 8 cache


Add Navigation Icon V7
Removed the teal square and drop shadow from the Add navigation icon.
Matched its dimensions and spacing to Home, Records, and Setup.
Uses white in Dark mode and the normal muted navigation color in Light mode.
Updated the PWA cache name and asset query versions to V7.


# App Icon Update V6

The Home Screen icon now follows the visual language of Apple dark icons: a near-black full-bleed background, high-contrast teal/mint wallet artwork, and a gold chart coin. It contains no text.

## Included icon files

- `icons/apple-touch-icon.png` — 180 x 180 iPhone/iPad Home Screen icon
- `icons/icon-192.png` — 192 x 192 manifest icon
- `icons/icon-512.png` — 512 x 512 manifest and maskable icon
- `icons/icon-1024.png` — 1024 x 1024 source render
- `icons/app-icon.svg` — editable vector source
- `icons/favicon.svg` — browser-tab icon

## iPhone behavior

The icon is deliberately designed as a universal dark-style icon, so it remains recognizable on both light and dark Home Screens. A Home Screen web app does not reliably switch between separate light and dark icon files in the same way as a native iOS app.

After publishing the update, remove the old Pocket Budget icon from the Home Screen and add it again so Safari captures the replacement icon.


# App Icon Update V5

The Home Screen icon now uses a wallet, banknotes, and a spending chart instead of the text “RM”.

## Files

- `icons/apple-touch-icon.png` — iPhone and iPad Home Screen icon (180 x 180)
- `icons/icon-192.png` — PWA icon
- `icons/icon-512.png` — PWA and maskable icon
- `icons/icon-1024.png` — high-resolution source render
- `icons/app-icon.svg` — editable vector source
- `icons/favicon.svg` — browser-tab icon

The icon uses a deep teal full-bleed background and high-contrast mint artwork, so the same asset remains clear on both light and dark iPhone Home Screens. Web apps do not currently have a reliable native-style separate dark Home Screen icon asset, so this universal design is used.

After replacing the files, remove the existing Home Screen icon and add the web app again so iOS captures the new icon.


# Navigation icon fix V4

The malformed black icons were caused by `index.html` being updated while an older
`styles.css` remained in the service-worker cache.

V4 fixes this by:

- adding explicit SVG stroke/fill attributes;
- versioning browser assets with `?v=4`;
- using a network-first service-worker strategy;
- forcing service-worker update checks during development.

For the first local test, open:

`http://localhost:8000/?v=4`

If an old version still appears, clear the site data for `localhost:8000` once and reload.





