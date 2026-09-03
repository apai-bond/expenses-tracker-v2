# Publish Pocket Budget Version 29 with GitHub Pages

1. Extract the ZIP file on your Windows computer.
2. Open your existing `pocket-budget` GitHub repository.
3. Upload all replacement files to the repository root. Upload the complete Version 29 project or the listed replacement files from the update package.
4. Confirm these files are directly beside `index.html`:

```text
app.js
backup-crypto.js
cycle.js
db.js
styles.css
calculations.py
service-worker.js
manifest.webmanifest
```

5. Commit the changes to the `main` branch.
6. In **Settings > Pages**, keep the source set to `main` and `/(root)`.
7. Wait for GitHub Pages to redeploy.
8. Open the Pages URL and refresh it once.
9. For an installed iPhone Home Screen app, close the app completely and reopen it.

Version 29 uses this service-worker cache:

```text
pocket-budget-v29-offline-javascript-sheet
```

If an old version remains in a desktop browser, open:

```text
https://YOUR-USERNAME.github.io/pocket-budget/?v=29
```


## Offline spreadsheet check

After publishing, open the **Sheet** tab and confirm:

1. The heading says **Offline spreadsheet**.
2. A single tap selects a cell without opening the keyboard.
3. **Edit** or the formula bar opens cell editing.
4. **Focus** expands the spreadsheet.
5. Existing cells from Version 28 remain visible.
6. Spreadsheet data is included when you create and restore an encrypted `.pbe` backup.

The spreadsheet does not use Google Sheets, Excel for the web, or OneDrive. No additional JavaScript library or cloud account is required.

## Encrypted backup test

1. Open **Setup > Local data**.
2. Tap **Export encrypted backup**.
3. Enter the same password twice. The password must contain at least 10 characters.
4. After encryption completes, tap **Save encrypted backup**.
5. Save the `.pbe` file in Files, iCloud Drive, Google Drive, Dropbox, or another private location.
6. Test restore with **Import encrypted backup** and the same password.

Encrypted backup export/import requires HTTPS or localhost. It works on GitHub Pages and on `http://localhost:8000` on the development computer. It is intentionally unavailable through a plain HTTP local-network address such as `http://192.168.1.50:8000`.

Do not upload personal `.pbe` files, old JSON backups, passwords, or other private data to the public repository.
