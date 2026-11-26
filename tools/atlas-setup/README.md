# KD Design — Atlas connection preparation (phase 1)

This is an independent setup tool, **not** a migration of the application backend.
The branch still uses PostgreSQL for API operations. Do not deploy it as a MongoDB
backend, remove PostgreSQL volumes, or use seed/init scripts against the old database.

## Configuration (local only)

1. In Atlas, use the KD-Final-Project cluster, add your current public IP, and create
   a database user with readWrite access to database kd_design.
2. In Cluster > Connect > Drivers, choose Node.js and copy the SRV URI.
3. Add MONGODB_URI to the existing server/.env without removing DATABASE_URL.
   Replace the password placeholder and set the path to /kd_design (URL-encode
   special characters in username/password). Keep credentials off GitHub.

From the repository root, on Node.js 22 or later:

```powershell
npm install --prefix tools/atlas-setup --no-package-lock --ignore-scripts
npm --prefix tools/atlas-setup run check
```

The check only pings Atlas and lists collection names. It does not create documents.
After confirming the correct Atlas cluster, to create the intended database:

```powershell
npm --prefix tools/atlas-setup run init
```

MongoDB creates databases on the first write. This command writes an idempotent
marker in _kd_setup, not products, brands, users, orders or other business data.
It never overwrites an existing marker, deletes data or accesses PostgreSQL.
Check Atlas Data Explorer for kd_design > _kd_setup.

The driver lives in an independent utility package to avoid modifying the existing
monorepo lockfile before the full backend migration. The tool is not a backup or
a PostgreSQL-to-MongoDB data migration script.

## Remaining application migration

Port the application queries, schema/indexes, seed and PostgreSQL export/import
to MongoDB; preserve API contracts, numeric legacy IDs, order/inventory atomicity,
membership, authentication, and media paths. Verify against a replica set and
Atlas before merging into main. Do not upload server/.env or customer data.
