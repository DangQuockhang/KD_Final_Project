# Standalone MongoDB application migration

The external-directory launcher has been removed. This branch is not a completed migration: the original SQL application files remain until the complete MongoDB implementation is integrated. The API and SQL database commands are deliberately blocked to avoid accidentally storing new data in PostgreSQL. The main branch is untouched.

Publish the existing migrated application's committed source to a separate review branch, `feature/mongodb-implementation`, after auditing secrets and excluding local environment files, uploads, backups and `.migration-work` artifacts. This is a one-time source transfer, not a runtime link. Do not copy the other checkout's .env or database files into Git. Review its driver, all routes, indexes, admin initialization, lockfile and tests before integrating. A standalone application must use only its own code and local MONGODB_URI, without an external project path.

The independent Atlas utilities remain available via `npm run atlas:check` and `npm run atlas:init` (install the utility dependencies first). They do not migrate the application or create business records. Do not delete old volumes or use demo seed on existing databases.
