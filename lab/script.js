const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
const countrySelect = document.querySelector('#lab-country-select');

const labCountries = {
  brazil: { name: 'Brazil' }
};

const requestedCountry = new URLSearchParams(window.location.search).get('country');
const activeCountry = labCountries[requestedCountry] ? requestedCountry : 'brazil';

if (countrySelect) {
  countrySelect.value = activeCountry;
  countrySelect.addEventListener('change', () => {
    const nextCountry = countrySelect.value;
    if (!labCountries[nextCountry] || nextCountry === activeCountry) return;
    const address = new URL(window.location.href);
    address.searchParams.set('country', nextCountry);
    address.searchParams.delete('dashboard');
    window.location.assign(`${address.pathname}${address.search}`);
  });
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    siteNav.setAttribute('data-open', String(!expanded));
    siteNav.style.display = expanded ? 'none' : 'flex';
  });

  siteNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 680) {
        siteNav.style.display = 'none';
        siteNav.setAttribute('data-open', 'false');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

const dashboardButtons = [...document.querySelectorAll('.dashboard-picker')];
const dashboardFrame = document.querySelector('#dashboard-frame');
const dashboardLoader = document.querySelector('#dashboard-loader');
const dashboardTitle = document.querySelector('#dashboard-title');
const dashboardDescription = document.querySelector('#dashboard-description');
const dashboardPosition = document.querySelector('#dashboard-position');
const dashboardOpen = document.querySelector('#dashboard-open');

function selectDashboard(button, updateAddress = true) {
  if (!button || !dashboardFrame) return;
  const position = dashboardButtons.indexOf(button);
  const src = button.dataset.src;

  dashboardButtons.forEach(item => {
    const active = item === button;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', String(active));
  });

  dashboardTitle.textContent = button.dataset.title;
  dashboardDescription.textContent = button.dataset.description;
  dashboardPosition.textContent = `${String(position + 1).padStart(2, '0')} / ${String(dashboardButtons.length).padStart(2, '0')}`;
  dashboardOpen.href = src;
  dashboardFrame.title = `${labCountries[activeCountry].name} ${button.dataset.title} dashboard`;

  if (dashboardFrame.dataset.dashboard !== button.dataset.dashboard) {
    dashboardLoader.classList.remove('is-hidden');
    dashboardFrame.dataset.dashboard = button.dataset.dashboard;
    dashboardFrame.src = src;
  }

  if (updateAddress) {
    const address = new URL(window.location.href);
    address.searchParams.set('dashboard', button.dataset.dashboard);
    history.replaceState({}, '', `${address.pathname}${address.search}#dashboards`);
  }
}

dashboardButtons.forEach(button => {
  button.addEventListener('click', () => selectDashboard(button));
});

dashboardFrame?.addEventListener('load', () => {
  dashboardLoader?.classList.add('is-hidden');
});

const requestedDashboard = new URLSearchParams(window.location.search).get('dashboard');
const requestedButton = dashboardButtons.find(button => button.dataset.dashboard === requestedDashboard);
if (requestedButton) selectDashboard(requestedButton, false);

function parseCSV(text) {
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value !== '')) records.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    records.push(row);
  }

  const headers = records.shift()?.map(header => header.trim()) || [];
  return records.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])));
}

function numberValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayPeriod(period) {
  return period ? period.replace('-T', ' Q') : '—';
}

function displayDate(value) {
  if (!value) return '—';
  const normalized = value.split(' ')[0];
  const [year, month, day] = normalized.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function displayPercent(value, digits = 2, showPositive = true) {
  const parsed = numberValue(value);
  if (parsed === null) return '—';
  const sign = showPositive && parsed > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(parsed)}%`;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

let nowcastRows = [];
let comparisonRows = [];
let rmseRows = [];

function quarterIndex(period) {
  const match = String(period || '').match(/^(\d{4})-(?:T|Q)([1-4])$/);
  return match ? Number(match[1]) * 4 + Number(match[2]) - 1 : null;
}

function quarterPeriod(index) {
  return `${Math.floor(index / 4)}-T${(index % 4) + 1}`;
}

function publicationBaseRows(rows, count = 2) {
  const observedQuarters = rows
    .map(row => quarterIndex(row.ultimo_pib_observado))
    .filter(Number.isFinite);
  if (!observedQuarters.length) return rows.slice(-count);

  const latestObserved = Math.max(...observedQuarters);
  const latestObservedPeriod = quarterPeriod(latestObserved);
  return Array.from({ length: count }, (_, offset) => {
    const period = quarterPeriod(latestObserved + offset + 1);
    const existing = rows.find(row => row.periodo === period);
    if (existing) return existing;

    const alternatives = comparisonRows.filter(row => row.periodo === period);
    const informationSets = alternatives
      .map(row => Number(rowInformationSet(row)))
      .filter(Number.isFinite);
    const informationSet = informationSets.length ? Math.max(...informationSets) : 0;
    return {
      periodo: period,
      fecha_referencia: alternatives[0]?.fecha_referencia || '',
      meses_disponibles: String(informationSet),
      ultimo_pib_observado: latestObservedPeriod
    };
  });
}

function nextPublicationRow(rows) {
  if (!rows.length) return null;
  const observedQuarters = rows
    .map(row => quarterIndex(row.ultimo_pib_observado))
    .filter(Number.isFinite);
  if (!observedQuarters.length) return rows.at(-1);
  const nextQuarter = Math.max(...observedQuarters) + 1;
  return rows.find(row => quarterIndex(row.periodo) === nextQuarter) || rows.at(-1);
}

const modelLabels = {
  rolling_120m: ['Rolling bridge', 'Rolling 120-month specification'],
  expansivo_6_variables: ['Expanding bridge', 'Expanding-history specification'],
  dfm_avanzado_estrategia3_lovo: ['Advanced DFM · leave-one-out', 'Automatic leave-one-variable-out specification'],
  dfm_avanzado_estrategia2_pesos: ['Advanced DFM · contribution pruning', 'Contribution-pruning specification'],
  dfm_avanzado_estrategia1_lasso: ['Advanced DFM · LASSO filter', 'LASSO-filtered specification'],
  dfm_lasso_sin_ar1: ['DFM + LASSO', 'Dynamic-factor specification'],
  pesos_senal_fuerte: ['Strong-signal bridge', 'Contemporaneous strong-signal specification']
};

function modelName(key) {
  return modelLabels[key]?.[0] || key || 'Selected model';
}

function rowModelKey(row) {
  return row?.variante_modelo || row?.modelo || '';
}

function rowInformationSet(row) {
  return String(row?.meses_disponibles || row?.informacion || '').trim().replace(/^M/i, '');
}

function rowRmseRatio(row) {
  return numberValue(row?.rmse_modelo_sobre_ar1 ?? row?.ratio_ar1);
}

function rowRmseImprovement(row) {
  return numberValue(row?.mejora_rmse_vs_ar1_pct ?? row?.mejora_ar1_pct);
}

function validationInformationSet(months) {
  return String(months) === '0' ? '1' : String(months);
}

function modelMetric(modelKey, months) {
  const validationMonths = validationInformationSet(months);
  return rmseRows.find(row => (
    row.muestra === 'completa_con_covid'
    && rowInformationSet(row) === validationMonths
    && rowModelKey(row) === modelKey
    && rowRmseRatio(row) !== null
  ));
}

function bestModelMetric(months, period) {
  const currentMonths = String(months);
  const validationMonths = validationInformationSet(months);
  const availableModels = new Set(comparisonRows
    .filter(row => row.periodo === period && rowInformationSet(row) === currentMonths)
    .map(rowModelKey));
  return rmseRows
    .filter(row => (
      row.muestra === 'completa_con_covid'
      && rowInformationSet(row) === validationMonths
      && rowRmseRatio(row) !== null
      && availableModels.has(rowModelKey(row))
    ))
    .sort((a, b) => rowRmseRatio(a) - rowRmseRatio(b))[0] || null;
}

function publishedPrediction(baseRow) {
  const metric = bestModelMetric(baseRow.meses_disponibles, baseRow.periodo);
  const selectedModel = rowModelKey(metric);
  const candidate = comparisonRows.find(row => (
    row.periodo === baseRow.periodo
    && rowInformationSet(row) === String(baseRow.meses_disponibles)
    && rowModelKey(row) === selectedModel
  ));
  const merged = { ...baseRow };
  Object.entries(candidate || {}).forEach(([key, value]) => {
    if (value !== '') merged[key] = value;
  });
  merged.published_model = selectedModel || merged.variante_modelo || 'rolling_120m';
  merged.rmse_modelo_sobre_ar1 = metric ? rowRmseRatio(metric) : '';
  merged.mejora_rmse_vs_ar1_pct = metric ? rowRmseImprovement(metric) : '';
  merged.rmse_information_set = validationInformationSet(baseRow.meses_disponibles);
  return merged;
}

function renderHeroNowcast(row) {
  if (!row) return;
  document.querySelectorAll('[data-latest-period]').forEach(element => { element.textContent = displayPeriod(row.periodo); });
  document.querySelectorAll('[data-latest-qoq]').forEach(element => { element.textContent = displayPercent(row.nowcast_pib_trimestral_pct, 2, false); });
  document.querySelectorAll('[data-latest-yoy-nsa]').forEach(element => { element.textContent = displayPercent(row.nowcast_pib_interanual_original_pct, 2, false); });
  document.querySelectorAll('[data-latest-months]').forEach(element => { element.textContent = `${row.meses_disponibles} / 3`; });
  setText('#pulse-model-chip', `Best vs AR(1) · ${modelName(row.published_model)}`);
  const ratio = numberValue(row.rmse_modelo_sobre_ar1);
  const isM0 = String(row.meses_disponibles) === '0';
  setText('#pulse-model-note', ratio === null
    ? 'The published specification is selected by all-quarter pseudo-out-of-sample RMSE relative to AR(1). Point estimate, not investment advice.'
    : `${modelName(row.published_model)} is published for ${isM0 ? 'the M0 forecast using M1 validation' : `M${row.meses_disponibles}`}: pseudo-out-of-sample RMSE is ${ratio.toFixed(3)}× AR(1). Point estimate, not investment advice.`);
}

function updateGauge(value) {
  const gauge = document.querySelector('#nowcast-gauge-fill');
  const parsed = numberValue(value);
  if (!gauge || parsed === null) return;
  const width = Math.min(48, Math.max(4, (Math.abs(parsed) / 1.25) * 48));
  gauge.style.width = `${width}%`;
  gauge.style.left = parsed >= 0 ? '50%' : `${50 - width}%`;
  gauge.style.background = parsed >= 0 ? 'var(--br-green-bright)' : '#f2ca3f';
}

function renderNowcast(row) {
  if (!row) return;
  const ratio = numberValue(row.rmse_modelo_sobre_ar1);
  const improvement = numberValue(row.mejora_rmse_vs_ar1_pct);
  const isM0 = String(row.meses_disponibles) === '0';
  setText('#nowcast-model-status', `Published · ${modelName(row.published_model)}`);
  setText('#nowcast-period', displayPeriod(row.periodo));
  setText('#nowcast-reference-date', `Reference: ${displayDate(row.fecha_referencia)}`);
  setText('#nowcast-qoq', displayPercent(row.nowcast_pib_trimestral_pct));
  setText('#nowcast-yoy-original', displayPercent(row.nowcast_pib_interanual_original_pct));
  setText('#nowcast-information', isM0 ? 'M0 · forecast' : `M${row.meses_disponibles} · ${row.meses_disponibles} month${row.meses_disponibles === '1' ? '' : 's'}`);
  const performance = ratio === null
    ? 'It is selected using the lowest all-quarter pseudo-out-of-sample RMSE relative to AR(1).'
    : `${modelName(row.published_model)} is selected because its ${isM0 ? 'earliest-vintage M1' : 'all-quarter'} pseudo-out-of-sample RMSE is ${ratio.toFixed(3)}× AR(1)${improvement === null ? '.' : `, an improvement of ${improvement.toFixed(1)}%.`}`;
  const informationText = isM0
    ? 'This is a model forecast made before monthly readings for the quarter are available'
    : `The estimate uses ${row.meses_disponibles} monthly reading${row.meses_disponibles === '1' ? '' : 's'}`;
  setText('#nowcast-context', `${informationText} and the latest observed GDP release is ${displayPeriod(row.ultimo_pib_observado)}. ${performance}`);
  updateGauge(row.nowcast_pib_trimestral_pct);
  renderModelComparison(row.periodo, row.meses_disponibles, row.published_model);
}

function buildPeriodTabs(nextReleasePeriod, selectedPeriod = nextReleasePeriod) {
  const tabs = document.querySelector('#nowcast-period-tabs');
  if (!tabs || !nowcastRows.length) return;
  tabs.innerHTML = '';

  nowcastRows.forEach((row, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${displayPeriod(row.periodo)}${row.periodo === nextReleasePeriod ? ' · next release' : ''}`;
    button.dataset.period = row.periodo;
    button.setAttribute('aria-pressed', String(row.periodo === selectedPeriod));
    button.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      renderNowcast(row);
      const address = new URL(window.location.href);
      address.searchParams.set('period', row.periodo);
      history.replaceState({}, '', `${address.pathname}${address.search}#nowcast`);
    });
    tabs.appendChild(button);
  });
}

function renderModelComparison(period, months, publishedModel) {
  const chart = document.querySelector('#model-comparison-chart');
  if (!chart) return;
  const rows = comparisonRows.filter(row => row.periodo === period && numberValue(row.nowcast_pib_trimestral_pct) !== null);
  chart.innerHTML = '';

  if (!rows.length) {
    chart.textContent = 'Model comparison unavailable.';
    return;
  }

  const maxMagnitude = Math.max(...rows.map(row => Math.abs(numberValue(row.nowcast_pib_trimestral_pct))), 0.25);
  const axis = document.createElement('div');
  axis.className = 'comparison-axis';
  axis.innerHTML = `<span>−${maxMagnitude.toFixed(1)}%</span><span>+${maxMagnitude.toFixed(1)}%</span>`;
  chart.appendChild(axis);

  rows.forEach(row => {
    const value = numberValue(row.nowcast_pib_trimestral_pct);
    const key = rowModelKey(row);
    const [name] = modelLabels[key] || [key || 'Model'];
    const informationSet = rowInformationSet(row) || String(months);
    const metric = modelMetric(key, informationSet);
    const ratio = rowRmseRatio(metric);
    const isPublished = key === publishedModel && informationSet === String(months);
    const validationNote = informationSet === '0' ? ' · M1 validation' : '';
    const description = `${isPublished ? 'Published' : 'Alternative'} · M${informationSet}${validationNote}${ratio === null ? '' : ` · RMSE / AR(1) ${ratio.toFixed(3)}`}`;
    const width = Math.max(2, (Math.abs(value) / maxMagnitude) * 48);
    const line = document.createElement('div');
    line.className = 'comparison-row';

    const label = document.createElement('div');
    label.className = 'comparison-label';
    const labelName = document.createElement('strong');
    labelName.textContent = name;
    const labelDescription = document.createElement('span');
    labelDescription.textContent = description;
    label.append(labelName, labelDescription);

    const track = document.createElement('div');
    track.className = 'comparison-track';
    const bar = document.createElement('span');
    bar.className = `comparison-bar ${isPublished ? 'production' : key === 'dfm_lasso_sin_ar1' ? 'experimental' : ''}`;
    bar.style.width = `${width}%`;
    bar.style.left = value >= 0 ? '50%' : `${50 - width}%`;
    track.appendChild(bar);

    const result = document.createElement('div');
    result.className = 'comparison-values';
    const qoqResult = document.createElement('span');
    qoqResult.innerHTML = `<small>q/q SA</small><strong>${displayPercent(value)}</strong>`;
    const yoyResult = document.createElement('span');
    yoyResult.innerHTML = `<small>y/y NSA</small><strong>${displayPercent(row.nowcast_pib_interanual_original_pct)}</strong>`;
    result.append(qoqResult, yoyResult);
    line.append(label, track, result);
    chart.appendChild(line);
  });
}

function renderSyncMetadata(manifest) {
  const timestamp = manifest?.generatedAtUtc || manifest?.sourceSnapshotUtc;
  if (!timestamp) return;
  const snapshot = new Date(timestamp);
  if (Number.isNaN(snapshot.getTime())) return;

  const label = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(snapshot);

  document.querySelectorAll('[data-sync-date]').forEach(element => {
    element.textContent = label;
    element.dateTime = snapshot.toISOString();
  });
}

async function loadNowcast() {
  try {
    const manifestRequest = fetch('../brazil/data/sync-manifest.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null);
    const [nowcastResponse, comparisonResponse, rmseResponse, manifest] = await Promise.all([
      fetch('../brazil/data/nowcast-current.csv', { cache: 'no-store' }),
      fetch('../brazil/data/model-comparison.csv', { cache: 'no-store' }),
      fetch('../brazil/data/model-rmse.csv', { cache: 'no-store' }),
      manifestRequest
    ]);

    if (!nowcastResponse.ok || !comparisonResponse.ok || !rmseResponse.ok) {
      throw new Error('One or more nowcast files are unavailable.');
    }

    const baseRows = parseCSV(await nowcastResponse.text());
    comparisonRows = parseCSV(await comparisonResponse.text());
    rmseRows = parseCSV(await rmseResponse.text());
    nowcastRows = publicationBaseRows(baseRows, 2).map(publishedPrediction);
    nowcastRows.sort((a, b) => a.periodo.localeCompare(b.periodo));

    const nextReleaseTarget = nextPublicationRow(nowcastRows);
    const requestedPeriod = new URLSearchParams(window.location.search).get('period');
    const selectedTarget = nowcastRows.find(row => row.periodo === requestedPeriod)
      || nextReleaseTarget;
    renderHeroNowcast(nextReleaseTarget);
    buildPeriodTabs(nextReleaseTarget?.periodo, selectedTarget?.periodo);
    renderNowcast(selectedTarget);
    renderSyncMetadata(manifest);
  } catch (error) {
    const chart = document.querySelector('#model-comparison-chart');
    if (chart) chart.textContent = 'Open this page through the website preview server to load the nowcast data.';
  }
}

loadNowcast();
