# Atlas bridge — local development

This branch is not a standalone MongoDB port. It launches the already-migrated
backend from an existing local checkout while preserving this frontend and its
port 4000 development proxy. The original server/src still contains PostgreSQL
code; no SQL routes were translated by this change. Do not merge into main or
deploy this bridge as a self-contained backend.

Requirements: Node 22+, the separate migrated project, its installed dependencies,
and a working Atlas URI for kd_design. Configure server/.env in this repository:
MONGODB_URI (authenticated mongodb+srv URI for kd_design), JWT_SECRET (32+ private
characters), KD_MONGO_BACKEND_DIR (absolute path to the migrated project).
Do not share or commit secrets. The launcher forwards configuration to the
separate project in its child process, without rewriting either .env file.
It sets the API port to 4000 and supplies an invalid PostgreSQL URL to guard
against accidental fallback. The MongoDB dependency and db.js checks are
heuristics, not proof of the implementation or Atlas connectivity.

From this repository:
- npm run atlas:source — validate path and list the source's scripts without connecting.
- npm run dev:api — launch the separate migrated backend using Atlas configuration.
- npm run dev:store — launch the existing store.
- npm run db:check — invoke the source's database check if available.
- npm run db:init — invoke the source's init only after inspecting its actual implementation.
- npm run db:admin — invoke a dedicated admin command if the source provides one;
  otherwise stop without seeding. Set a private ADMIN_EMAIL and ADMIN_PASSWORD first.
- npm run db:seed and PostgreSQL rollback commands are blocked on this branch.

If dependencies are missing, install with npm ci in the separate migrated project.
If the source uses different configuration variable names or has an incompatible
API contract, inspect and adjust that implementation before using real data.

Verify GET /api/health, /api/products and /api/brands via http://localhost:4000,
then verify login, write operations and the Atlas Data Explorer with PostgreSQL
and local MongoDB stopped. Do not delete old Docker containers or volumes.
The backend may still store uploaded files on its own disk; back these up separately.
