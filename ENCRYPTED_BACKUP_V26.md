# Version 26 - Encrypted Backup Files

## What changed

- New backups are saved as password-encrypted `.pbe` files.
- The Monday reminder now starts the encrypted-backup workflow.
- A password dialog is shown before export.
- Encryption happens before the file is offered for saving.
- The password fields are cleared after encryption or decryption.
- Import asks for the password before replacing local data.
- Older unencrypted Pocket Budget JSON backups remain importable for migration.

## Encryption design

```text
Pocket Budget data
  -> JSON
  -> PBKDF2-SHA-256 password key (600,000 iterations, random salt)
  -> AES-256-GCM encryption (random 96-bit IV)
  -> .pbe file
```

AES-GCM encrypts the data and checks whether the file has been modified. A new random salt and IV are generated for every backup.

## Weekly reminder behavior

- A reminder becomes due every Monday.
- If the app is not opened on Monday, it appears the next time the app is opened during that week.
- **Remind me tomorrow** postpones the reminder by one local calendar day.
- The week is completed only after the encrypted file save/share step succeeds or a browser download is started.
- Cancelling the password or save dialog keeps the reminder due.

## Password rules

- New backup passwords require at least 10 characters.
- The password is not stored in IndexedDB or localStorage.
- Pocket Budget cannot recover a forgotten password.
- Import accepts the password used when the backup was created.

## Secure-context requirement

Web Crypto requires a secure browser context.

Supported testing locations:

```text
http://localhost:8000
https://YOUR-USERNAME.github.io/pocket-budget/
```

A plain local-network HTTP address such as this can display the app but cannot use encrypted export/import:

```text
http://192.168.1.50:8000
```

## What remains unencrypted

Version 26 encrypts the exported backup file only. The live IndexedDB database on the device remains unencrypted while the app is installed.
