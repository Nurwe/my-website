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

The model pipeline and both website views enforce a permanent two-quarter publication horizon: the first two quarters after the latest observed GDP release are always selected. The nearest quarter is a nowcast using its actual M1/M2/M3 information set; a farther quarter with no monthly releases is labeled M0 and remains a model-generated forecast. For M1/M2/M3, the website publishes the available specification with the lowest full-sample pseudo-out-of-sample RMSE relative to GDP AR(1). M0 uses the earliest-vintage M1 ranking as a conservative proxy because the current historical evaluation contains M1/M2/M3 vintages. The sync stops before replacing the published snapshot if either required quarter is missing, so a partial model run cannot silently reduce the website to one quarter. No nowcasting methodology document is currently published; both interfaces display “Methodology coming soon” until the formal document is ready.

Run a one-time sync:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-brazil.ps1
```

The successful dashboard-download and nowcasting-model launchers in `Brasil - Nico\Programador Tareas` call `sincronizar_sitio_local.bat` as their final step. This updates the local website immediately after any full or sector dashboard run and after every successful production-model run. Simulations and failed runs do not replace the website snapshot, and no Git command is executed by these hooks.

Install the per-user weekly local safety sync and run it once immediately:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-brazil-sync-task.ps1 -StartNow
```

The task runs every Sunday at 09:00 as a fallback and synchronizes only the validated local Brazil snapshot. It never stages, commits, or pushes files. It writes its ignored local log to `scripts/brazil-sync.log`. If the computer is off at that time, Windows runs it when the task becomes available again. The day and time can be customized during installation, for example with `-DayOfWeek Friday -At 18:00`. Remove it with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uninstall-brazil-sync-task.ps1
```

The synchronizer stops before replacing the website snapshot if either of the two required forecast quarters is absent. GitHub publication is deliberately manual; review the local changes and push them when ready. `scripts/publish-brazil.ps1` remains available as an explicit manual helper, but it is not called by either the post-run hooks or the weekly task.
