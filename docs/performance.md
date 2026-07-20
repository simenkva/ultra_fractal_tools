# M5 performance and lifecycle budgets

The reference measurements below were recorded on 2026-07-20 using Node
25.6.1 on macOS 26.5.2 arm64 with 12 logical CPUs and 32 GiB RAM. Budgets are
intentionally looser than this machine's observed results so normal CI and
developer-machine variation does not create noise.

## Analyzer budgets

Run `npm run benchmark:analyzer` after `npm test`. It analyzes three files near
the corpus median size and the five largest files by bytes, each in a fresh
worker.

| Scenario | Enforced budget | Reference result |
| --- | ---: | ---: |
| Typical file, approximately 32–34 KiB | 2,000 ms per file | 15–20 ms per file |
| Large file, approximately 4.2–5.3 MiB | 15,000 ms per file | 1.1–2.2 seconds per file |
| Five large files, sequential wall time | 45,000 ms | approximately 8.8 seconds |
| Large-file analyzer heap | 768 MiB per worker | 227–500 MiB after analysis |

The worker heap limit also contains pathological files. The full 403-file scan
has a 120-second per-file timeout; the reference sequential scan completed in
48.6 seconds, and its slowest file took 2.19 seconds. Total scan wall time is
reported but not enforced because spawning 403 isolated workers is especially
sensitive to storage and host load.

## Grammar budgets

`npm run benchmark:grammar` tokenizes the three largest files by line count in
parallel workers. Every line has a two-second TextMate timeout, and the combined
wall-time budget is 60 seconds. The reference run tokenized 472,700 lines and
5,591,632 tokens in 14.1 seconds of wall time. No line stopped early.

## Extension lifecycle budgets

Live analysis runs outside the Extension Host. A new edit cancels and
terminates the obsolete worker, so a multi-megabyte analysis cannot later
publish stale diagnostics. The controller caches only diagnostic arrays for an
unchanged document version and import-root set; display severity and maximum
changes reuse that result. Import creation or deletion invalidates all
import-sensitive analysis caches.

The Extension Host test uses a generated source document larger than 2 MiB. It
requires the worker to start, replaces the entire document, and allows 15
seconds for cancellation plus publication of the corrected version. It also
checks that an unchanged manual validation increments the cache-hit count
without starting another analyzer worker. Closing the document cancels pending
work, clears diagnostics, and removes controller state and cached results.
