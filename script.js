const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const expanded = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', String(!expanded));
    nav.style.display = expanded ? 'none' : 'flex';
  });
}

const links = document.querySelectorAll('.site-nav a');
links.forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth <= 680 && nav) {
      nav.style.display = 'none';
      nav.setAttribute('data-open', 'false');
    }
  });
});

const predictionData = {
  argentina: {
    name: 'Argentina', code: 'AR', release: '15 October 2026',
    variables: {
      inflation: {
        label: 'Monthly inflation',
        factors: ['Exchange-rate pass-through', 'Fiscal consolidation', 'Wage and price dynamics'],
        chartTitle: 'Monthly inflation outlook',
        chartUnit: 'Month-on-month change · %',
        activeModel: 'ar2',
        models: {
          ar2: { label: 'AR(2)', description: 'Benchmark model', dataUrl: 'Data/argentina_inflation_forecast.csv', value: 'Loading…', horizon: 'Next release', summary: 'Loading the AR(2) forecast.', methodologyTitle: 'Argentina inflation · AR(2)', methodologyUrl: 'reports/argentina/inflation/argentina-inflation-ar2-methodology.pdf' },
          sarima: { label: 'SARIMA', description: 'Seasonal alternative', dataUrl: 'Data/argentina_inflation_forecast_sarima.csv', value: 'Loading…', horizon: 'Next release', summary: 'Loading the SARIMA forecast.', methodologyTitle: 'Argentina inflation · SARIMA' }
        }
      },
      coreInflation: { label: 'Core inflation', value: 'Planned', horizon: '1–6 months', summary: 'A short-horizon forecast designed to test whether disinflation persists after removing regulated and seasonal price movements.', factors: ['Exchange-rate pass-through', 'Wage and price dynamics', 'Money and credit conditions', 'Inflation expectations'] },
      activity: { label: 'EMAE activity nowcast', value: 'Planned', horizon: 'Current month', summary: 'A monthly nowcast of economic activity using indicators released before the official EMAE estimate.', factors: ['Industrial production and construction', 'Imports and tax revenue', 'Private credit', 'Consumption indicators'] },
      exchange: { label: 'Official exchange rate', value: 'Planned', horizon: 'Monthly / year-end', summary: 'A forecast of the official ARS/USD rate conditional on the policy regime and position within the exchange-rate band.', factors: ['International reserves', 'Inflation differential', 'Interest rates', 'Exchange-rate policy'] },
      realWages: { label: 'Real wages', value: 'Planned', horizon: '3–6 months', summary: 'An estimate of whether nominal wages will outpace consumer prices and support household purchasing power.', factors: ['Nominal wage settlements', 'Headline and core inflation', 'Labor-market conditions', 'Public-sector wages'] },
      fiscalBalance: { label: 'Primary fiscal balance', value: 'Planned', horizon: 'Monthly / annual', summary: 'A forecast of the monthly primary result and the full-year balance as a share of GDP.', factors: ['Real tax revenue', 'Pensions and transfers', 'Energy subsidies', 'Economic activity'] },
      reserves: { label: 'Reserve accumulation', value: 'Planned', horizon: 'Monthly', summary: 'A forecast of monthly changes in BCRA international reserves, with gross and estimated net measures kept separate.', factors: ['Trade and energy balance', 'Agricultural export seasonality', 'Debt payments', 'FX intervention and valuation effects'] },
      sovereignRisk: { label: 'Sovereign-risk regime', value: 'Planned', horizon: '3–12 months', summary: 'A probability estimate for Argentina entering or leaving a high-spread sovereign-risk regime rather than a precise basis-point forecast.', factors: ['Fiscal balance and reserves', 'US interest rates', 'Commodity prices', 'Political and policy events'] }
    }
  },
  brazil: {
    name: 'Brazil', code: 'BR', release: 'Weekly automatic update',
    notice: 'Live production nowcast — complete dashboards and detailed estimates are available in the Macro Lab.',
    variables: {
      growth: {
        label: 'Quarterly GDP nowcast',
        value: 'Loading…',
        valueLabel: 'Quarter on quarter · SA',
        secondaryValue: 'Loading…',
        secondaryLabel: 'Year on year · NSA',
        horizon: 'Current quarter',
        summary: 'Loading the production GDP nowcast.',
        dataUrl: 'brazil/data/nowcast-current.csv',
        chartTitle: 'Brazil GDP nowcast path',
        chartUnit: 'Quarter-on-quarter change · seasonally adjusted · %',
        factors: ['Monthly activity and labor signals', 'Credit and financial conditions', 'External trade and demand', 'Fiscal and consumption indicators'],
        methodologyTitle: 'Brazil GDP nowcast methodology · coming soon'
      },
      inflation: { label: 'Inflation outlook', value: 'Dashboard live', horizon: 'Current conditions', summary: 'Detailed IPCA, inflation-core, producer-price, and target-path analysis is available in the Brazil real-economy dashboard.', factors: ['Food and energy prices', 'Currency movements', 'Inflation expectations', 'Monetary-policy stance'] }
    }
  },
  switzerland: {
    name: 'Switzerland', code: 'CH', release: 'To be announced',
    variables: {
      inflation: { label: 'Inflation', value: 'Coming soon', horizon: '12 months', summary: 'The first Switzerland outlook is being prepared.', factors: ['Swiss franc', 'Imported inflation', 'Domestic services'] },
      growth: { label: 'Real GDP growth', value: 'Coming soon', horizon: '2027', summary: 'The outlook will connect external demand with domestic conditions.', factors: ['Euro-area demand', 'Pharmaceutical exports', 'Household consumption'] }
    }
  }
};

const explorer = document.querySelector('.prediction-explorer');
const variableSelect = document.querySelector('#prediction-variable');
const availableMapCountries = { ARG: 'argentina', BRA: 'brazil', CHE: 'switzerland' };

function projectCoordinate([longitude, latitude]) {
  return [((longitude + 180) / 360) * 1000, ((90 - latitude) / 180) * 500];
}

function ringToPath(ring) {
  return ring.map((coordinate, index) => {
    const [x, y] = projectCoordinate(coordinate);
    return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join('') + 'Z';
}

function geometryToPath(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map(polygon => polygon.map(ringToPath).join('')).join('');
}

async function loadWorldMap() {
  const mapGroup = document.querySelector('.map-countries');
  const loadingLabel = document.querySelector('.map-loading');
  if (!mapGroup) return;
  try {
    const response = await fetch('assets/world-countries-50m.geojson');
    if (!response.ok) throw new Error('Map data unavailable');
    const world = await response.json();
    world.features.forEach(feature => {
      if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return;
      const countryKey = availableMapCountries[feature.properties.ADM0_A3];
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', geometryToPath(feature.geometry));
      shape.setAttribute('class', countryKey ? 'country-shape country-marker' : 'country-shape');
      if (countryKey) {
        shape.dataset.country = countryKey;
        if (explorer?.dataset.country === countryKey) shape.classList.add('is-selected');
        shape.setAttribute('role', 'button');
        shape.setAttribute('tabindex', '0');
        shape.setAttribute('aria-label', `${predictionData[countryKey].name} — outlook available`);
        shape.addEventListener('click', () => selectCountry(countryKey));
        shape.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectCountry(countryKey);
          }
        });
      }
      mapGroup.appendChild(shape);
    });
    loadingLabel?.remove();
  } catch (error) {
    if (loadingLabel) loadingLabel.textContent = 'Open through the local preview server to load the map.';
  }
}

function getDisplayVariable(variable) {
  if (!variable.models) return variable;
  return { ...variable, ...variable.models[variable.activeModel] };
}

function renderModelControl(countryKey, variableKey, variable) {
  const control = document.querySelector('#model-control');
  const modelSelect = document.querySelector('#prediction-model');
  const description = document.querySelector('#model-description');
  if (!control || !modelSelect || !description) return;
  if (!variable.models) {
    control.hidden = true;
    modelSelect.innerHTML = '';
    return;
  }
  control.hidden = false;
  const active = variable.models[variable.activeModel];
  description.textContent = active.description;
  modelSelect.innerHTML = Object.entries(variable.models).map(([modelKey, model]) =>
    `<option value="${modelKey}" ${modelKey === variable.activeModel ? 'selected' : ''}>${model.label} — ${model.description}</option>`
  ).join('');
  modelSelect.onchange = () => {
    variable.activeModel = modelSelect.value;
    renderVariable(countryKey, variableKey);
  };
}

function renderVariable(countryKey, variableKey) {
  const variableDefinition = predictionData[countryKey].variables[variableKey];
  const variable = getDisplayVariable(variableDefinition);
  renderModelControl(countryKey, variableKey, variableDefinition);
  document.querySelector('#forecast-value-label').textContent = variable.valueLabel || 'Forecast';
  document.querySelector('#forecast-value').textContent = variable.value;
  const secondaryCell = document.querySelector('#forecast-secondary-cell');
  if (secondaryCell) {
    const hasSecondaryValue = Boolean(variable.secondaryLabel);
    secondaryCell.hidden = !hasSecondaryValue;
    document.querySelector('#forecast-secondary-label').textContent = variable.secondaryLabel || '';
    document.querySelector('#forecast-secondary-value').textContent = variable.secondaryValue || '—';
  }
  document.querySelector('.forecast-card')?.classList.toggle('has-rate-suite', hasSecondaryValue);
  document.querySelector('#forecast-horizon').textContent = variable.horizon;
  document.querySelector('#forecast-summary').textContent = variable.summary;
  document.querySelector('#forecast-factors').innerHTML = variable.factors.map(factor => `<li>${factor}</li>`).join('');
  const methodologyTitle = document.querySelector('#methodology-title');
  const methodologyDownload = document.querySelector('#methodology-download');
  if (methodologyTitle && methodologyDownload) {
    methodologyTitle.textContent = variable.methodologyTitle || 'Methodology coming soon';
    methodologyDownload.setAttribute('aria-disabled', String(!variable.methodologyUrl));
    methodologyDownload.href = variable.methodologyUrl || '#';
    methodologyDownload.textContent = variable.methodologyUrl ? 'Download methodology' : 'Coming soon';
    if (variable.methodologyUrl) methodologyDownload.setAttribute('download', '');
    else methodologyDownload.removeAttribute('download');
  }
  renderForecastChart(variable);
}

function renderForecastChart(variable) {
  const chart = document.querySelector('#forecast-chart');
  if (!chart) return;
  if (!variable.series || variable.series.length < 2) {
    chart.innerHTML = '<p class="chart-placeholder">A forecast path will be added with the published outlook.</p>';
    chart.removeAttribute('role');
    return;
  }

  const width = 430;
  const height = 190;
  const padding = { top: 18, right: 24, bottom: 32, left: 42 };
  const values = variable.series.map(point => point.value).filter(Number.isFinite);
  const firstForecast = variable.series.findIndex(point => point.forecast);
  const forecastIndex = firstForecast === -1 ? variable.series.length : firstForecast;
  const hasObserved = variable.series.some(point => !point.forecast);
  const rawMinimum = Math.min(...values);
  const rawMaximum = Math.max(...values);
  const initialMinimum = rawMinimum >= 0 ? 0 : Math.floor(rawMinimum - 0.25);
  const initialMaximum = Math.max(0, Math.ceil(rawMaximum + 0.5));
  const roughStep = Math.max((initialMaximum - initialMinimum) / 4, 0.1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const niceFraction = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;
  const tickStep = niceFraction * magnitude;
  const minimum = Math.floor(initialMinimum / tickStep) * tickStep;
  const maximum = Math.ceil(initialMaximum / tickStep) * tickStep || tickStep;
  const x = index => padding.left + index * ((width - padding.left - padding.right) / (variable.series.length - 1));
  const y = value => padding.top + (maximum - value) * ((height - padding.top - padding.bottom) / (maximum - minimum));
  const actualPoints = variable.series.slice(0, forecastIndex).map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const forecastStart = forecastIndex > 0 ? forecastIndex - 1 : 0;
  const forecastPoints = firstForecast === -1 ? '' : variable.series.slice(forecastStart).map((point, index) => `${x(forecastStart + index)},${y(point.value)}`).join(' ');
  const tickValues = [];
  for (let tick = minimum; tick <= maximum + tickStep / 10; tick += tickStep) tickValues.push(tick);
  const gridLines = tickValues.map(tick => `
    <line class="chart-grid ${Math.abs(tick) < tickStep / 10 ? 'zero' : ''}" x1="${padding.left}" y1="${y(tick)}" x2="${width - padding.right}" y2="${y(tick)}" />
    <text class="chart-axis-label" x="${padding.left - 8}" y="${y(tick) + 3}" text-anchor="end">${Number(tick.toFixed(1))}%</text>`).join('');
  const pointSpacing = (width - padding.left - padding.right) / (variable.series.length - 1);
  const forecastDivider = firstForecast <= 0 ? null : x(firstForecast) - pointSpacing / 2;
  const showEveryLabel = variable.series.length > 10 ? 3 : 1;
  const lastObserved = Math.max(0, forecastIndex - 1);
  const dots = variable.series.map((point, index) => {
    const pointDescription = Number.isFinite(point.secondaryValue)
      ? `q/q SA ${formatPercent(point.value)}; y/y NSA ${formatPercent(point.secondaryValue)}`
      : formatPercent(point.value);
    return `
      <circle class="chart-dot ${point.forecast ? 'forecast' : ''}" cx="${x(index)}" cy="${y(point.value)}" r="3.4"><title>${point.year}: ${pointDescription}</title></circle>
      ${(index === lastObserved || point.forecast) ? `<text class="chart-value ${point.forecast ? 'forecast' : ''}" x="${x(index)}" y="${y(point.value) - 10}" text-anchor="middle">${formatPercent(point.value)}</text>` : ''}
      ${(index % showEveryLabel === 0 || index === variable.series.length - 1) ? `<text class="chart-label" x="${x(index)}" y="${height - 8}" text-anchor="middle">${point.year}</text>` : ''}`;
  }).join('');
  const hasIntervals = variable.series.some(point => Number.isFinite(point.lower80) || Number.isFinite(point.lower95));

  chart.setAttribute('role', 'img');
  const latestPoint = variable.series.at(-1);
  const latestDescription = Number.isFinite(latestPoint.secondaryValue)
    ? `${formatPercent(latestPoint.value)} q/q SA and ${formatPercent(latestPoint.secondaryValue)} y/y NSA`
    : `${formatPercent(latestPoint.value)} forecast`;
  chart.setAttribute('aria-label', `${variable.chartTitle || variable.label} from ${variable.series[0].year} to ${latestDescription} in ${latestPoint.year}`);
  chart.innerHTML = `
    <div class="chart-heading">
      <div class="chart-title-group"><strong>${variable.chartTitle || 'Quarterly GDP outlook'}</strong><span>${variable.chartUnit || 'Year-on-year change · %'}</span></div>
      <div class="chart-legend">${hasObserved ? '<span><i></i>Observed</span>' : ''}<span><i class="forecast"></i>Forecast</span></div>
    </div>
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${forecastDivider === null ? '' : `<rect class="chart-forecast-area" x="${forecastDivider}" y="${padding.top}" width="${width - padding.right - forecastDivider}" height="${height - padding.top - padding.bottom}" rx="6" />`}
      ${gridLines}
      ${forecastDivider === null ? '' : `<line class="chart-forecast-divider" x1="${forecastDivider}" y1="${padding.top}" x2="${forecastDivider}" y2="${height - padding.bottom}" />`}
      ${actualPoints ? `<polyline class="chart-line" points="${actualPoints}" />` : ''}
      ${forecastPoints ? `<polyline class="chart-forecast-line" points="${forecastPoints}" />` : ''}
      ${dots}
    </svg>
    ${Number.isFinite(latestPoint.secondaryValue) ? `<p class="chart-note">Line: q/q SA. Latest year-on-year result: ${formatPercent(latestPoint.secondaryValue)} NSA.</p>` : hasIntervals ? '<p class="chart-note">Point forecast shown. Confidence intervals are retained in the source data.</p>' : ''}`;
}

function parsePredictionCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = lines.shift().split(',').map(header => header.trim());
  return lines.filter(Boolean).map(line => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']));
  });
}

function formatMonth(dateString) {
  const [year, month] = dateString.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatPercent(value, fractionDigits = 2) {
  return `${new Intl.NumberFormat('en', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)}%`;
}

function quarterIndex(period) {
  const match = String(period || '').match(/^(\d{4})-(?:T|Q)([1-4])$/);
  return match ? Number(match[1]) * 4 + Number(match[2]) - 1 : null;
}

function quarterPeriod(index) {
  return `${Math.floor(index / 4)}-T${(index % 4) + 1}`;
}

function brazilPublicationBaseRows(rows, comparisonRows, count = 2) {
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
      .map(row => Number(brazilRowInformationSet(row)))
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

const brazilModelLabels = {
  rolling_120m: 'Rolling bridge',
  expansivo_6_variables: 'Expanding bridge',
  dfm_avanzado_estrategia3_lovo: 'Advanced DFM · leave-one-out',
  dfm_avanzado_estrategia2_pesos: 'Advanced DFM · contribution pruning',
  dfm_avanzado_estrategia1_lasso: 'Advanced DFM · LASSO filter',
  dfm_lasso_sin_ar1: 'DFM + LASSO',
  pesos_senal_fuerte: 'Strong-signal bridge'
};

function brazilRowModelKey(row) {
  return row?.variante_modelo || row?.modelo || '';
}

function brazilRowInformationSet(row) {
  return String(row?.meses_disponibles || row?.informacion || '').trim().replace(/^M/i, '');
}

function brazilRowRmseRatio(row) {
  const value = row?.rmse_modelo_sobre_ar1 ?? row?.ratio_ar1;
  return value === '' || value === null || value === undefined ? Number.NaN : Number(value);
}

function brazilRowRmseImprovement(row) {
  const value = row?.mejora_rmse_vs_ar1_pct ?? row?.mejora_ar1_pct;
  return value === '' || value === null || value === undefined ? Number.NaN : Number(value);
}

function brazilValidationInformationSet(months) {
  return String(months) === '0' ? '1' : String(months);
}

function bestBrazilModelMetric(rmseRows, comparisonRows, months, period) {
  const currentMonths = String(months);
  const validationMonths = brazilValidationInformationSet(months);
  const availableModels = new Set(comparisonRows
    .filter(row => row.periodo === period && brazilRowInformationSet(row) === currentMonths)
    .map(brazilRowModelKey));
  return rmseRows
    .filter(row => (
      row.muestra === 'completa_con_covid'
      && brazilRowInformationSet(row) === validationMonths
      && Number.isFinite(brazilRowRmseRatio(row))
      && availableModels.has(brazilRowModelKey(row))
    ))
    .sort((a, b) => brazilRowRmseRatio(a) - brazilRowRmseRatio(b))[0] || null;
}

function selectBrazilPublishedPrediction(baseRow, comparisonRows, rmseRows) {
  const metric = bestBrazilModelMetric(rmseRows, comparisonRows, baseRow.meses_disponibles, baseRow.periodo);
  const selectedModel = brazilRowModelKey(metric);
  const candidate = comparisonRows.find(row => (
    row.periodo === baseRow.periodo
    && brazilRowInformationSet(row) === String(baseRow.meses_disponibles)
    && brazilRowModelKey(row) === selectedModel
  ));
  const merged = { ...baseRow };
  Object.entries(candidate || {}).forEach(([key, value]) => {
    if (value !== '') merged[key] = value;
  });
  merged.published_model = selectedModel || merged.variante_modelo || 'rolling_120m';
  merged.rmse_modelo_sobre_ar1 = metric ? brazilRowRmseRatio(metric) : '';
  merged.mejora_rmse_vs_ar1_pct = metric ? brazilRowRmseImprovement(metric) : '';
  merged.rmse_information_set = brazilValidationInformationSet(baseRow.meses_disponibles);
  return merged;
}

async function loadArgentinaInflationModel(modelKey) {
  const inflation = predictionData.argentina.variables.inflation;
  const model = inflation.models[modelKey];
  try {
    const response = await fetch(model.dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${model.label} CSV unavailable`);
    const rows = parsePredictionCSV(await response.text());
    const series = rows.map(row => {
      const forecast = row.period.toLowerCase() === 'forecast';
      return {
        year: formatMonth(row.date),
        value: Number(forecast ? row.forecast_inflation_pct : row.actual_inflation_pct),
        forecast,
        lower80: row.lower_80 ? Number(row.lower_80) : null,
        upper80: row.upper_80 ? Number(row.upper_80) : null,
        lower95: row.lower_95 ? Number(row.lower_95) : null,
        upper95: row.upper_95 ? Number(row.upper_95) : null
      };
    }).filter(point => Number.isFinite(point.value));
    const forecasts = series.filter(point => point.forecast);
    if (!forecasts.length) throw new Error('No forecast rows found');
    const nextMonth = forecasts[0];
    model.series = series;
    model.value = formatPercent(nextMonth.value);
    model.horizon = nextMonth.year;
    model.summary = `The ${model.label} model projects monthly inflation of ${formatPercent(nextMonth.value)} for ${nextMonth.year}. Point forecasts are shown in the chart; uncertainty intervals remain available in the source data.`;
  } catch (error) {
    model.value = 'Data unavailable';
    model.summary = `Replace ${model.dataUrl} with a file using the expected column structure.`;
  }
  if (explorer?.dataset.country === 'argentina' && variableSelect?.value === 'inflation' && inflation.activeModel === modelKey) renderVariable('argentina', 'inflation');
}

function loadArgentinaInflationModels() {
  Object.keys(predictionData.argentina.variables.inflation.models).forEach(loadArgentinaInflationModel);
}

async function loadBrazilNowcast() {
  const growth = predictionData.brazil.variables.growth;
  try {
    const [response, comparisonResponse, rmseResponse] = await Promise.all([
      fetch(growth.dataUrl, { cache: 'no-store' }),
      fetch('brazil/data/model-comparison.csv', { cache: 'no-store' }),
      fetch('brazil/data/model-rmse.csv', { cache: 'no-store' })
    ]);
    if (!response.ok || !comparisonResponse.ok || !rmseResponse.ok) throw new Error('Brazil nowcast model outputs unavailable');
    const baseRows = parsePredictionCSV(await response.text());
    const comparisonRows = parsePredictionCSV(await comparisonResponse.text());
    const rmseRows = parsePredictionCSV(await rmseResponse.text());
    const rows = brazilPublicationBaseRows(baseRows, comparisonRows, 2)
      .map(row => selectBrazilPublishedPrediction(row, comparisonRows, rmseRows));
    growth.series = rows.map(row => ({
      year: row.periodo.replace('-T', ' Q'),
      value: Number(row.nowcast_pib_trimestral_pct),
      secondaryValue: Number(row.nowcast_pib_interanual_original_pct),
      forecast: true
    })).filter(point => Number.isFinite(point.value));
    const publicationTarget = nextPublicationRow(rows);
    const estimate = Number(publicationTarget.nowcast_pib_trimestral_pct);
    const annual = Number(publicationTarget.nowcast_pib_interanual_original_pct);
    growth.value = formatPercent(estimate);
    growth.secondaryValue = formatPercent(annual);
    growth.horizon = publicationTarget.periodo.replace('-T', ' Q');
    const selectedModelName = brazilModelLabels[publicationTarget.published_model] || publicationTarget.published_model;
    const rmseRatio = Number(publicationTarget.rmse_modelo_sobre_ar1);
    const rmseImprovement = publicationTarget.mejora_rmse_vs_ar1_pct === ''
      ? Number.NaN
      : Number(publicationTarget.mejora_rmse_vs_ar1_pct);
    const validationNote = Number.isFinite(rmseRatio)
      ? `${selectedModelName} is published for M${publicationTarget.meses_disponibles} because its all-quarter pseudo-out-of-sample RMSE is ${rmseRatio.toFixed(3)}× AR(1)${Number.isFinite(rmseImprovement) ? `, an improvement of ${rmseImprovement.toFixed(1)}%` : ''}.`
      : 'The published specification is selected by its all-quarter pseudo-out-of-sample RMSE relative to AR(1).';
    growth.summary = `The next unpublished GDP quarter is ${growth.horizon}. The model nowcasts real GDP growth of ${formatPercent(estimate)} quarter on quarter (seasonally adjusted) and ${formatPercent(annual)} year on year (not seasonally adjusted), using ${publicationTarget.meses_disponibles} monthly readings. ${validationNote}`;
    growth.methodologyTitle = 'Brazil GDP nowcast methodology · coming soon';
    growth.methodologyUrl = null;
  } catch (error) {
    growth.value = 'Data unavailable';
    growth.secondaryValue = 'Data unavailable';
    growth.summary = 'The Brazil nowcast file could not be loaded in this preview.';
  }
  if (explorer?.dataset.country === 'brazil') {
    document.querySelector('#next-release').textContent = predictionData.brazil.release;
    if (variableSelect?.value === 'growth') renderVariable('brazil', 'growth');
  }
}

function selectCountry(countryKey) {
  const country = predictionData[countryKey];
  if (!country || !explorer || !variableSelect) return;
  explorer.dataset.view = 'detail';
  explorer.dataset.country = countryKey;
  document.querySelector('.map-reset').hidden = false;
  document.querySelector('.country-code').textContent = country.code;
  document.querySelector('.country-title h3').textContent = country.name;
  document.querySelector('#next-release').textContent = country.release;
  const notice = document.querySelector('.sample-notice');
  if (notice) notice.textContent = country.notice || 'Preview data — final forecasts will be published here.';
  const researchCard = document.querySelector('#country-research-card');
  if (researchCard) researchCard.hidden = countryKey !== 'brazil';
  document.querySelectorAll('.country-marker').forEach(marker => marker.classList.toggle('is-selected', marker.dataset.country === countryKey));
  variableSelect.innerHTML = Object.entries(country.variables).map(([key, variable]) => `<option value="${key}">${variable.label}</option>`).join('');
  renderVariable(countryKey, variableSelect.value);
}

document.querySelectorAll('[data-country]').forEach(control => {
  control.addEventListener('click', () => selectCountry(control.dataset.country));
  control.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectCountry(control.dataset.country);
    }
  });
});

variableSelect?.addEventListener('change', () => renderVariable(explorer.dataset.country, variableSelect.value));
document.querySelector('.map-reset')?.addEventListener('click', () => {
  explorer.dataset.view = 'map';
  document.querySelector('.map-reset').hidden = true;
  document.querySelectorAll('.country-marker').forEach(marker => marker.classList.remove('is-selected'));
});

loadWorldMap();
loadArgentinaInflationModels();
loadBrazilNowcast();

const requestedCountry = new URLSearchParams(window.location.search).get('country');
if (requestedCountry && predictionData[requestedCountry]) selectCountry(requestedCountry);
