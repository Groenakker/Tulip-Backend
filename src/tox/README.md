# Tox workspace (ported from `toxintelligence-mern`)

This directory hosts the ToxIntelligence API surface, namespaced under
`/api/tox/v1/*` and wired into Tulip from `src/index.js`:

```js
import { registerToxRoutes } from "./tox/registerToxRoutes.js";
// ...
registerToxRoutes(app, "/api/tox/v1");
```

## Layout

| Folder | Purpose |
| --- | --- |
| `services/`   | One file per upstream data source (PubChem, ChEMBL, PubMed, EPA CompTox, etc.) + the `reportBuilder` and `chembl` aggregators. |
| `routes/v1/`  | 27 modular Express sub-routers + `v1.routes.js` (legacy routes that weren't broken out). |
| `models/`     | Mongoose models. Every collection is prefixed `tox_` to keep Tulip's own collections untouched. |
| `utils/`      | `routeHelpers.util.js` (asyncRoute / parsers) and `traEvidence.util.js`. |
| `middleware/` | `upload.middleware.js` — multer memoryStorage for chemistry-import XLSX uploads. |
| `registerToxRoutes.js` | Mounts the v1 router under any prefix. |

## What was intentionally removed during the port

- `auth/*` handlers (`/session`, `/session/options`) and the
  `enforceAuthenticatedWrites` / `requireProtectedSession` middlewares
  — Tulip provides its own JWT auth.
- The Tox session models / cookie helpers (`authSession.models.js`,
  `session.service.js`, `cryptoSession.js`, `resolveActor.util.js`,
  `session.middleware.js`) — same reason.
- The Tox `config/env.js` — Tulip already validates env in
  `src/lib/envValidator.js`; only the deps `axios` and `xml2js` were
  added to `package.json` for the Tox graph.

## Auth-gating switch point

Today the Tox routes are **open** (no `verifyToken`, no
`checkPermission`). To gate them, edit `registerToxRoutes.js`:

```js
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkPermission } from "../middleware/permission.middleware.js";

export function registerToxRoutes(app, prefix = "/api/tox/v1") {
  const router = express.Router();
  router.use(verifyToken);
  router.use(checkPermission("Toxicology", "read")); // optional
  registerV1Routes(router);
  app.use(prefix, router);
}
```

Then seed a `"Toxicology"` permission row (see Tulip's
`models/permissions.models.js`) and add a `permission` field to the
Toxicology entry in `Tulip-Frontend/src/components/Sidebar.jsx`.

## Optional env keys

All optional. The Tox graph will boot with deterministic heuristics if
none are set; populate them to enable real upstream calls.

- `ANTHROPIC_API_KEY` — Anthropic key for the AI report narrative.
- `SERPAPI_KEY` — SerpApi key for the `/websearch/*` endpoints.
- `AMBIT_API_BASE` — Base URL for an AMBIT/Toxtree instance.
- `RDKIT_SIDECAR_URL` — Optional RDKit similarity sidecar URL.

## Mongo collision insurance

Every Mongoose model in `models/` declares `collection: "tox_*"`
explicitly. The Mongoose model *names* are unchanged from the original
project, so any code that imports `LibraryCompound` etc. keeps working
without changes.
