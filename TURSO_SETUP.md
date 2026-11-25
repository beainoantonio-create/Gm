# Moving the database from Firebase to Turso

Vercel -> Project -> Settings -> Environment Variables. Add:

| Name | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://...turso.io` (from the Turso dashboard) |
| `TURSO_AUTH_TOKEN` | the database token from the Turso dashboard |
| `MIGRATION_KEY` | any long random password (8+ characters) you make up |

1. Redeploy. The site keeps using Firebase - nothing changes yet.
2. Check: open `https://YOUR-SITE/api/admin/migrate-to-turso?key=YOUR_MIGRATION_KEY` (counts only, copies nothing).
3. Copy: open the same address with `&run=1` added. Run it when Firebase's daily limit has reset.
4. Switch: add `DB_PROVIDER` = `turso` in Vercel and redeploy. `https://YOUR-SITE/api/health` should now say `"provider":"turso"`.
5. Afterwards delete `MIGRATION_KEY`. Firebase is untouched, so switching back = delete `DB_PROVIDER` and redeploy.

Don't edit properties/bookings between steps 3 and 4. If you do, repeat step 3 with `&force=1` just before step 4.
