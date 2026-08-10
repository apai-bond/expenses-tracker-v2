# Pocket Budget - Version 27 Encrypted Backup + iPhone Import Fix

Pocket Budget is a mobile-first personal expense tracker that can run in Safari on an iPhone. Records are stored locally in IndexedDB on the device.

## Main features

- Budget month based on the salary cycle rather than the 1st to the last day of the month
- Standard salary day set to the 27th of the previous month
- Automatic weekend adjustment to the previous Friday
- Manual actual salary-date adjustment for public holidays or other early payments
- Expense, income, and saving transactions
- Monthly salary and saving target
- Custom categories
- Edit and delete transactions
- Summary cards and expense charts
- Local IndexedDB database
- Password-encrypted backup and restore
- Monday weekly backup reminder that remains due until an encrypted backup is saved
- Light and Dark appearance
- Progressive Web App files
- Python calculation logic through Pyodide

## Salary-cycle example

The **August 2026** budget normally covers:

```text
27 July 2026 to 26 August 2026
```

Therefore, a transaction entered on 27 July is part of the August budget.

If the 27th falls on a weekend, the automatic date moves backward to Friday. Public holidays are not downloaded because the app is designed to work locally and offline. Use **Setup > Salary received / cycle start date** to enter the actual earlier salary date.

The cycle end is calculated automatically as one day before the next salary date.

## Important test-version security note

This version does not encrypt the local database and does not use a password. Do not enter banking passwords, card numbers, identity documents, or other highly sensitive information.

GitHub contains only the application code. Salary and expense records remain in the browser database on the device that entered them.

## File responsibilities

- `index.html`: application screens
- `styles.css`: mobile design and Light/Dark appearance
- `cycle.js`: salary-cycle date calculations
- `db.js`: IndexedDB local database operations
- `app.js`: interface, navigation, charts, cycle handling, and backup workflow
- `backup-crypto.js`: AES-GCM backup encryption and PBKDF2 password-key derivation
- `calculations.py`: Python financial summary calculations
- `manifest.webmanifest`: installable app information
- `service-worker.js`: local asset caching
- `start_server.py`: simple Python development server

## Test on Windows

1. Extract the project folder.
2. Open Command Prompt or PowerShell in the folder.
3. Run:

```text
python start_server.py
```

4. Open:

```text
http://localhost:8000/?v=26
```

Do not double-click `index.html`. The app loads its files through the local web server.

## Test on an iPhone on the same Wi-Fi

1. Keep `python start_server.py` running on the Windows computer.
2. Run `ipconfig` in Command Prompt.
3. Find the computer IPv4 address, for example `192.168.1.50`.
4. Open Safari on the iPhone and enter:

```text
http://192.168.1.50:8000/?v=26
```

The computer and iPhone must be connected to the same local network. Allow Python through Windows Firewall on private networks when prompted.

The interface can be tested through this local-network HTTP address, but encrypted export/import requires a secure context. Use `http://localhost:8000` on the laptop or the HTTPS GitHub Pages address on the iPhone to test encryption.

## Publish with GitHub Pages

Upload all project files to the repository root, including the new `cycle.js` file. GitHub Pages should deploy from the `main` branch and `/ (root)` folder.

After deployment, close and reopen the Home Screen app. Version 27 uses this cache name:

```text
pocket-budget-v27-ios-backup-import
```

## Data backup

Use **Setup > Export encrypted backup**. Enter and confirm a password, wait for encryption to finish, then tap **Save encrypted backup** and choose Files, iCloud Drive, Google Drive, Dropbox, or another safe location.

Backup files use the `.pbe` extension. The records and spreadsheet data are encrypted with AES-256-GCM. The password is converted into an encryption key with PBKDF2-SHA-256 and is never stored by the app. A forgotten password cannot be recovered.

Importing an encrypted backup requires its password and replaces the current local data after confirmation. Older unencrypted Pocket Budget JSON backups can still be imported for compatibility, but all new exports are encrypted.

Clearing Safari website data or removing stored site data can delete the local database. Keep encrypted backups while testing. The IndexedDB database itself remains unencrypted in Version 27.

## Python learning area

Start in `calculations.py`. It calculates:

- total income
- total expenses
- total savings
- available balance
- savings rate
- saving-target progress
- average daily spending based on elapsed salary-cycle days
- expense totals by category

## Version 10 - iPhone date picker fit

The transaction date and salary-cycle start date are constrained to the form width on iPhone Safari. The fix preserves the native iPhone date picker and does not change existing IndexedDB records.

## Version 12: adjustable Custom Sheet sizes

The Custom Sheet now supports individual column widths and row heights. On iPhone, select a cell and open **Cell size** to use the sliders. On a computer, you can also drag the right edge of a column heading or the bottom edge of a row number. Size settings are saved locally and included in backups.


## Version 13 layout cleanup

- Salary-cycle summary is shown only on the Setup page.
- Empty spreadsheet cells are vertically centered with their row numbers.
- Touch devices hide row/column drag guides; use the Cell size panel instead.

## Merged cells (Version 15)

The Custom Sheet supports rectangular merged ranges. Select the first cell, tap **Merge cells**, then tap the opposite corner. Only the top-left value is retained. Tap a merged cell and choose **Unmerge** to restore the individual empty cells. Merged ranges are stored in IndexedDB and included in backups.


## Dashboard links (Version 16)

The Custom Sheet can display live values from the current Home dashboard in any chosen cell. Available values are **Total income**, **Expenses**, **Saved**, and **Available balance**. Open **Sheet**, choose a value, enter a target such as `A10`, and tap **Link value**. The linked cell updates when the selected budget month, salary, saving entries, or transactions change.

Use **Refresh** for a manual update or **Unlink cell** to restore a normal editable cell. Dashboard formulas can also be entered directly: `=TOTALINCOME()`, `=EXPENSES()`, `=SAVED()`, and `=AVAILABLE()`. Linked cells can be used in other calculations, such as `=A10+500`. Links are saved in IndexedDB and included in backups.

## Version 17: cleaner spreadsheet values

- Dashboard-linked cells show only the amount, without the small metric label.
- Formula cells show the calculated value after editing instead of displaying the formula in the cell.
- Numeric formula results use Malaysian currency formatting such as `RM 700.00`.
- Select a formula cell to edit its original formula in the formula bar.



## Version 18: Home dashboard values in the Sheet

The **Dashboard link** dropdown now includes:

- Total income
- Expenses
- Saved
- Available balance

Each linked cell displays the selected value as `RM 0.00` and updates automatically. Direct formulas are also supported: `=TOTALINCOME()`, `=EXPENSES()`, `=SAVED()`, and `=AVAILABLE()`.


## Version 19: RM formatting in the Custom Sheet

Select a spreadsheet cell and use **RM format** to display a number as Malaysian Ringgit without converting it into text. The underlying numeric value remains usable in formulas. Tap **Remove RM** for plain-number display. Cell formats are stored locally and included in backups.

## Version 26: encrypted Monday backup reminder

Pocket Budget checks the encrypted-backup status whenever the app starts, returns from the background, or becomes visible again. A reminder is due from Monday onward until an encrypted backup is saved for that week.

- Open the app on Monday: the reminder appears.
- Do not open the app on Monday: it appears the next time the app is opened during that week.
- Tap **Create encrypted backup**: choose a password, encrypt the data, then tap **Save encrypted backup**.
- Tap **Remind me tomorrow**: the reminder is postponed until the next calendar day.
- Use **Setup > Local data** to see the last encrypted backup and the next reminder date.
- A manual encrypted export also completes the current week's reminder.
- Cancelling the save step leaves the reminder active.

The reminder status is stored locally in the browser. The exported `.pbe` file is encrypted, but the live IndexedDB database remains local and unencrypted.


## Version 27 - iPhone encrypted backup import

The iPhone file picker is intentionally left unfiltered so `.pbe` backups can be selected. Pocket Budget validates the file contents after selection. Version 26 `.pbe` backups remain compatible.

## Version 27 iPhone backup sharing correction

Encrypted backup sharing now sends only the `.pbe` file to the iPhone share sheet. No descriptive text payload is included, preventing iOS Files from creating an additional `text` sidecar file beside the backup. The encrypted backup format and Version 27 import compatibility are unchanged.
