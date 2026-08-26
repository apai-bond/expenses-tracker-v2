# Version 28 - Two-week encrypted backup reminder

- Backup reminder interval changed from 7 days to 14 days.
- The reminder is scheduled for every second Monday based on the week of the last completed encrypted backup.
- If Pocket Budget is not opened on the scheduled Monday, the popup remains due and appears the next time the app is opened or resumed.
- `Remind me tomorrow` still postpones the popup by one calendar day.
- Creating an encrypted backup resets the 14-day cycle from the Monday of the week in which the backup was created.
- Existing V27 backup history stored in localStorage remains compatible.
- Encrypted `.pbe` export/import behavior is unchanged.
