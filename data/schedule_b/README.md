# Schedule B export concordance

This folder holds the U.S. Census Bureau's **Schedule B export concordance**.
It is loaded into MongoDB as the reference list for the customs / HS tariff
code picker that appears on the Sample submission form. Once a sample has a
tariff code attached, the Shippo customs declaration for any international
shipment that includes that sample is populated automatically.

## Files

| File           | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `econcord.txt` | Fixed-width Schedule B export codes + descriptions (~10k) |
| `exp-stru.txt` | Census's record layout document for `econcord.txt`        |
| `readme.txt`   | Original readme that ships in Census's `SBSDF.ZIP`        |

## Where it came from

<https://www.census.gov/foreign-trade/schedules/b/index.html#download>

Census publishes the concordance ZIP a few times a year. Download
`SBSDF.ZIP`, extract `econcord.txt` (export codes) and replace the file in
this folder when you want to refresh.

## How to load it

```bash
# from Tulip-Backend/
npm run data:load-schedule-b
# or
node scripts/loadScheduleB.js --file ./data/schedule_b/econcord.txt --year 2026
```

The loader is idempotent: it upserts each row by `code`, so re-running it
after a Census refresh updates descriptions in place. Codes that exist in
the DB but are missing from the new file are marked `obsolete: true` rather
than deleted, so historical shipments still resolve.
