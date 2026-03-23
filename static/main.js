/* ──────────────────────────────────────────────────────────────────────────
   SepsisAI · Frontend Logic
   Talks to Flask backend at /api/predict and /api/clinical-summary
   ────────────────────────────────────────────────────────────────────────── */

'use strict';

// ── DOM References ───────────────────────────────────────────────────────────

const noteInput = document.getElementById('note-input');
const charCount = document.getElementById('char-count');
const csvInput = document.getElementById('csv-input');
const dropZone = document.getElementById('drop-zone');
const dropContent = document.getElementById('drop-content');
const csvPreviewWrap = document.getElementById('csv-preview-wrapper');
const csvTable = document.getElementById('csv-table');
const clearCsvBtn = document.getElementById('clear-csv-btn');
const runBtn = document.getElementById('run-btn');
const btnText = document.getElementById('btn-text');
const resultsSection = document.getElementById('results-section');
const riskBanner = document.getElementById('risk-banner');
const bannerIcon = document.getElementById('banner-icon');
const bannerStatus = document.getElementById('banner-status');
const bannerDetail = document.getElementById('banner-detail');
const bannerPercent = document.getElementById('banner-percent');
const metricsStrip = document.getElementById('metrics-strip');
const summaryLoader = document.getElementById('summary-loader');
const summaryContent = document.getElementById('summary-content');
const toast = document.getElementById('toast');

let selectedFile = null;
let toastTimer = null;

// ── Utilities ────────────────────────────────────────────────────────────────

function showToast(message, type = 'error') {
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 5000);
}

function setRunBtnLoading(loading) {
  const icon = runBtn.querySelector('.btn-run-icon');
  if (loading) {
    runBtn.classList.add('loading');
    icon.textContent = '⏳';
    btnText.textContent = 'Analysing…';
    runBtn.disabled = true;
  } else {
    runBtn.classList.remove('loading');
    icon.textContent = '⚡';
    btnText.textContent = 'Run Multimodal Prediction';
    checkRunReady();
  }
}

function checkRunReady() {
  runBtn.disabled = !(noteInput.value.trim().length > 0 && selectedFile !== null);
}

// ── Character Counter ────────────────────────────────────────────────────────

noteInput.addEventListener('input', () => {
  charCount.textContent = noteInput.value.length;
  checkRunReady();
});

// ── CSV Drop Zone ────────────────────────────────────────────────────────────

['dragenter', 'dragover'].forEach(evt =>
  dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('drag-over'); })
);

['dragleave', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); })
);

dropZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

csvInput.addEventListener('change', () => {
  if (csvInput.files[0]) handleFile(csvInput.files[0]);
});

clearCsvBtn.addEventListener('click', () => {
  selectedFile = null;
  csvInput.value = '';
  csvPreviewWrap.classList.add('hidden');
  dropContent.innerHTML = `
    <div class="dropzone-icon">📂</div>
    <p class="dropzone-primary">Drop your CSV here or <span class="link-text">browse</span></p>
    <p class="dropzone-secondary">Max 24 rows · Required columns: Lactate, WBC, Creatinine, Platelets, Bilirubin</p>
  `;
  checkRunReady();
});

function handleFile(file) {
  if (!file.name.endsWith('.csv')) {
    showToast('Please upload a valid .csv file.', 'error');
    return;
  }
  selectedFile = file;

  // Update drop zone to show file name
  dropContent.innerHTML = `
    <div class="dropzone-icon">✅</div>
    <p class="dropzone-primary" style="color:var(--accent-safe)">${file.name}</p>
    <p class="dropzone-secondary">${(file.size / 1024).toFixed(1)} KB uploaded</p>
  `;

  // Parse and preview
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    renderCsvPreview(text);
  };
  reader.readAsText(file);

  checkRunReady();
}

function renderCsvPreview(csvText) {
  const rows = csvText.trim().split('\n').map(r => r.split(',').map(c => c.trim()));
  if (rows.length < 2) return;

  const headers = rows[0];
  const dataRows = rows.slice(1, 6); // show max 5 rows

  let html = '<thead><tr>';
  headers.forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';

  dataRows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => { html += `<td>${cell}</td>`; });
    html += '</tr>';
  });

  html += '</tbody>';
  csvTable.innerHTML = html;
  csvPreviewWrap.classList.remove('hidden');
}

// ── Run Prediction ────────────────────────────────────────────────────────────

runBtn.addEventListener('click', async () => {
  const noteText = noteInput.value.trim();
  if (!noteText) { showToast('Please enter clinical notes.', 'warning'); return; }
  if (!selectedFile) { showToast('Please upload a lab CSV file.', 'warning'); return; }

  setRunBtnLoading(true);
  resultsSection.classList.add('hidden');

  const formData = new FormData();
  formData.append('note_text', noteText);
  formData.append('lab_csv', selectedFile);

  try {
    const res = await fetch('/api/predict', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) { showToast(data.error || 'Prediction failed.', 'error'); return; }

    renderResults(data);
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Fetch clinical summary independently (can be slow)
    fetchClinicalSummary(noteText);

  } catch (err) {
    showToast('Network error — is the Flask server running?', 'error');
  } finally {
    setRunBtnLoading(false);
  }
});

// ── Render Results ────────────────────────────────────────────────────────────

// Cache latest data so we can re-render on resize
let _lastData = null;

function renderResults(data) {
  _lastData = data;
  const { risk_percent, status, lab_trends, last_values, deltas } = data;
  const isAlert = status === 'ALERT';

  // Banner
  riskBanner.className = `risk-banner ${isAlert ? 'alert' : 'stable'}`;
  bannerIcon.textContent = isAlert ? '🚨' : '✅';
  bannerStatus.textContent = isAlert ? 'SEPSIS ALERT' : 'PATIENT STABLE';
  bannerDetail.textContent = isAlert
    ? 'Clinical decision support suggests immediate intervention.'
    : 'No immediate sepsis risk detected. Continue monitoring.';
  bannerPercent.textContent = `${risk_percent.toFixed(1)}%`;

  // Charts — wait one tick so containers are visible & have real dimensions
  requestAnimationFrame(() => {
    renderGauge(risk_percent);
    renderTrends(lab_trends);
  });

  // Metrics
  renderMetrics(last_values, deltas);

  // Clear old summary
  summaryContent.textContent = '';
  summaryContent.innerHTML = '<span style="color:var(--text-muted); font-style:italic">Generating AI insights…</span>';
}

// Debounced resize — re-render charts when window resizes
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (_lastData) {
      renderGauge(_lastData.risk_percent);
      renderTrends(_lastData.lab_trends);
    }
  }, 150);
});

function renderGauge(riskPercent) {
  const color = riskPercent > 70 ? '#ef4444' : riskPercent > 35 ? '#f59e0b' : '#22c55e';
  const el = document.getElementById('gauge-chart');
  const w = el.getBoundingClientRect().width || 300;
  const h = Math.min(w * 0.85, 300); // proportional, max 300px

  const trace = {
    type: 'indicator',
    mode: 'gauge+number',
    value: riskPercent,
    number: { suffix: '%', font: { size: 30, color } },
    domain: { x: [0, 1], y: [0, 1] },
    gauge: {
      axis: {
        range: [0, 100],
        tickwidth: 1,
        tickcolor: '#4a5c73',
        tickfont: { color: '#7a8ba8', size: 10 },
        dtick: 25,
      },
      bar: { color, thickness: 0.65 },
      bgcolor: 'rgba(0,0,0,0)',
      borderwidth: 0,
      steps: [
        { range: [0, 35], color: 'rgba(34,197,94,0.15)' },
        { range: [35, 70], color: 'rgba(245,158,11,0.15)' },
        { range: [70, 100], color: 'rgba(239,68,68,0.15)' },
      ],
      threshold: {
        line: { color: '#94a3b8', width: 2 },
        thickness: 0.75,
        value: 35,
      },
    },
  };

  const layout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    width: w,
    height: h,
    margin: { l: 24, r: 24, t: 24, b: 24 },
    font: { family: 'Inter, sans-serif', color: '#e8edf5' },
    autosize: false,
  };

  Plotly.react('gauge-chart', [trace], layout, { displayModeBar: false, responsive: false });
}

function renderTrends(labTrends) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const palette = {
    Lactate: '#ef4444',
    WBC: '#f59e0b',
    Creatinine: '#8b5cf6',
    Platelets: '#06b6d4',
    Bilirubin: '#22c55e',
  };

  const traces = Object.entries(labTrends).map(([col, vals]) => ({
    x: hours,
    y: vals,
    name: col,
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: palette[col] || '#3b82f6', width: 2.5 },
    marker: { size: 4 },
    hovertemplate: `<b>${col}</b>: %{y:.2f}<br>Hour %{x}<extra></extra>`,
  }));

  // Platelets on secondary Y (very different scale)
  traces.find(t => t.name === 'Platelets').yaxis = 'y2';

  const el = document.getElementById('trends-chart');
  const w = el.getBoundingClientRect().width || 600;
  const h = 300;

  const layout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, sans-serif', color: '#7a8ba8', size: 11 },
    width: w,
    height: h,
    autosize: false,
    margin: { l: 52, r: 60, t: 16, b: 60 },
    xaxis: {
      title: { text: 'Hours in ICU', font: { size: 11 } },
      gridcolor: 'rgba(56,139,253,0.08)',
      zerolinecolor: 'rgba(56,139,253,0.15)',
      tickfont: { color: '#4a5c73' },
    },
    yaxis: {
      title: { text: 'Lactate / WBC / Creatinine / Bilirubin', font: { size: 10 } },
      gridcolor: 'rgba(56,139,253,0.08)',
      zerolinecolor: 'rgba(56,139,253,0.15)',
      tickfont: { color: '#4a5c73' },
    },
    yaxis2: {
      title: { text: 'Platelets', font: { size: 10 } },
      overlaying: 'y',
      side: 'right',
      gridcolor: 'transparent',
      tickfont: { color: '#06b6d4' },
    },
    legend: {
      orientation: 'h',
      y: -0.28,
      x: 0.5,
      xanchor: 'center',
      bgcolor: 'rgba(0,0,0,0)',
      font: { size: 10 },
    },
    hovermode: 'x unified',
  };

  Plotly.react('trends-chart', traces, layout, { displayModeBar: false, responsive: false });
}

function renderMetrics(lastValues, deltas) {
  const cols = ['Lactate', 'WBC', 'Creatinine', 'Platelets', 'Bilirubin'];
  // For Platelets, down = bad (inverse) — so negative delta is "negative" (bad)
  // For others, up is bad

  metricsStrip.innerHTML = cols.map(col => {
    const val = lastValues[col];
    const delta = deltas[col];
    const isPlatelets = col === 'Platelets';

    let deltaClass = 'neutral';
    let arrow = '';

    if (Math.abs(delta) > 0.001) {
      const isBad = isPlatelets ? delta < 0 : delta > 0;
      deltaClass = isBad ? 'negative' : 'positive';
      arrow = delta > 0 ? '▲' : '▼';
    }

    return `
      <div class="metric-card">
        <div class="metric-label">${col}</div>
        <div class="metric-value">${val.toFixed(2)}</div>
        <div class="metric-delta ${deltaClass}">
          ${arrow} <span>${delta > 0 ? '+' : ''}${delta.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Clinical Summary ──────────────────────────────────────────────────────────

async function fetchClinicalSummary(noteText) {
  summaryLoader.classList.remove('hidden');

  try {
    const res = await fetch('/api/clinical-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_text: noteText }),
    });
    const data = await res.json();

    if (!res.ok) {
      summaryContent.innerHTML = `<span style="color:var(--accent-alert)">${data.error}</span>`;
    } else {
      // Render markdown-lite (bold **text** and bullet points)
      summaryContent.innerHTML = renderMarkdownLite(data.summary);
    }
  } catch (err) {
    summaryContent.innerHTML = '<span style="color:var(--text-muted)">Summary unavailable.</span>';
  } finally {
    summaryLoader.classList.add('hidden');
  }
}

function renderMarkdownLite(text) {
  // Convert **bold** → <strong>, bullet points, and newlines
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
