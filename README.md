# Nicolas Aragona · Economics Portfolio

A static economics portfolio with country outlooks, forecast data, and a complete Brazil macro research suite.

## Main structure

- `index.html`, `styles.css`, `script.js` — portfolio homepage, country map, and forecast explorer.
- `Data/` and `reports/` — Argentina forecast outputs and methodology.
- `lab/` — reusable country Lab interface and country selector. Brazil is the first available country.
- `brazil/` — synchronized Brazil publication assets consumed by the Lab.
  - `dashboards/` contains five complete, self-contained published dashboards.
  - `data/` contains the production GDP nowcast and model outputs consumed by the interface.
  - `research/` contains validation, historical test charts, and model diagnostics.
- `cv/` and `writings/` — supporting portfolio pages and documents.

## Run locally

The country map and prediction interfaces load local data files with `fetch`, so serve the directory over HTTP rather than opening `index.html` directly:

```powershell
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## Automatic Brazil publication sync

The five published dashboard files remain self-contained and unmodified so every chart, filter, download, detailed view, and print/PDF action stays available. `scripts/sync-brazil.ps1` safely mirrors the published dashboards and GDP-nowcast outputs from `C:\Users\narag\Desktop\Brasil - Nico` into the website. It copies only stable, changed files, replaces each destination atomically, and never writes to the source project.

For each M1/M2/M3 information set, the website publishes the available specification with the lowest full-sample pseudo-out-of-sample RMSE relative to GDP AR(1). The rule is evaluated in the browser from the synchronized `model-rmse.csv` and `model-comparison.csv` outputs, so updated validation results automatically change the published model. No nowcasting methodology document is currently published; both interfaces display “Methodology coming soon” until the formal document is ready.

Run a one-time sync:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-brazil.ps1
```

Install the per-user weekly Windows sync and run it once immediately:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-brazil-sync-task.ps1 -StartNow
```

The task runs every Sunday at 09:00 and writes its ignored local log to `scripts/brazil-sync.log`. If the computer is off at that time, Windows runs it when the task becomes available again. The day and time can be customized during installation, for example with `-DayOfWeek Friday -At 18:00`. Remove it with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uninstall-brazil-sync-task.ps1
```

This keeps the local website worktree synchronized. If the public site is deployed from GitHub, the resulting website changes still need to be committed and pushed through the normal deployment workflow; a cloud build cannot directly read a folder on this computer.
