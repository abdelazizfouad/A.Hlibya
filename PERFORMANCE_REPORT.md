# Local ERP performance report

## Diagnosis

The SQLite database contains 6,956 parts, 8,171 inventory rows, and 8,269 movement rows.
Before this change, startup selected and parsed every inventory and movement JSON row into
JavaScript arrays. The measured database-module initialization time was about 6 seconds on
the current PC. That approach would become impractical as the operational tables approach
hundreds of thousands or millions of rows.

The normal application bootstrap already used 50-row pages, but the server startup path
undid that benefit by hydrating the complete operational tables.

## Changes

- Operational inventory and movement rows remain in indexed SQLite tables and are loaded only
  through paged API queries.
- Bootstrap and server status counts now use SQL `COUNT(*)` instead of JavaScript array sizes.
- A stock movement loads only the affected part's inventory rows.
- Part deletion and movement deletion operate against indexed SQL rows without requiring a
  full in-memory operational dataset.
- SQLite uses WAL mode, a busy timeout, and `synchronous=NORMAL` for safer concurrent reads
  with lower read latency.
- Added `scripts/performance-test.mjs`, runnable with `npm run performance`.
- Existing per-request `[PERF]` logging records SQL time, backend time, total time, response
  size, and status.

## Measurements

Measured locally against the current database after the change:

| Request | Total time |
|---|---:|
| Health | 11 ms server timing, 151 ms HTTP cold measurement |
| Bootstrap | about 17 ms HTTP measurement |
| Catalog page (50 rows) | about 13 ms server timing |
| Part-number search | about 27 ms server timing |
| Inventory page (50 rows) | about 29 ms server timing |
| Movement page (50 rows) | about 12 ms server timing |

The HTTP client measurements include local process/network overhead and were approximately
20-151 ms after warm-up. Public Cloudflare timing was not measured because the active tunnel URL is
runtime-generated and was not provided as a stable test target.

## Data safety

No records are deleted, no destructive migration is performed, and the source JSON values
for part numbers, serial numbers, prices, and quantities are preserved. Full operational
data is still included when the explicit backup endpoint is requested; normal page loads do
not create that full snapshot.

## Validation

`npm run build` passes. The repository's existing TypeScript check still reports an unrelated
pre-existing error in `src/components/parts/BarcodePrintModal.tsx` (`defaultLocationId` is
not declared on `PartMaster`).

## Online Part Number search fix

The online path uses the same PC API through Cloudflare Tunnel. The delay was caused by
search requests accumulating while the user typed: previous requests were not aborted, and
each numeric search performed an exact query plus a full `COUNT(*)` query. The online tunnel
therefore carried obsolete requests before the current result.

The search path now aborts stale browser requests, caches repeated exact searches briefly,
and uses the normalized `part_number_key`/`barcode_key` indexes for an exact lookup without
the count read. Search caches are invalidated on part writes and deletes. Partial/name
search remains available as a fallback.

Five real in-stock part numbers were tested through the API:

| Part number | Matches | First/uncached request |
|---|---:|---:|
| `0002021619` | 1 | 60 ms server timing |
| `0002021719` | 1 | 2 ms server timing |
| `0004203105` | 1 | 1 ms server timing |
| `0004211112` | 1 | 1 ms server timing |
| `0004212112` | 1 | 1 ms server timing |
