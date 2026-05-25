'use strict';

const PASTEL_COLORS = [
  { name: 'ラベンダー', main: '#7F77DD', light: '#EEEDFE', dark: '#3C3489' },
  { name: 'ミント',     main: '#5DCAA5', light: '#E1F5EE', dark: '#085041' },
  { name: 'スカイ',     main: '#85B7EB', light: '#E6F1FB', dark: '#0C447C' },
  { name: 'コーラル',   main: '#F0997B', light: '#FAECE7', dark: '#712B13' },
  { name: 'ローズ',     main: '#ED93B1', light: '#FBEAF0', dark: '#72243E' },
  { name: 'ピーチ',     main: '#FAC775', light: '#FAEEDA', dark: '#633806' },
  { name: 'ライム',     main: '#97C459', light: '#EAF3DE', dark: '#27500A' },
  { name: 'ベビーブルー', main: '#B5D4F4', light: '#E6F1FB', dark: '#185FA5' },
  { name: 'サーモン',   main: '#F5C4B3', light: '#FAECE7', dark: '#993C1D' },
  { name: 'ライラック', main: '#AFA9EC', light: '#EEEDFE', dark: '#534AB7' },
  { name: 'アクア',     main: '#9FE1CB', light: '#E1F5EE', dark: '#0F6E56' },
  { name: 'バター',     main: '#EF9F27', light: '#FAEEDA', dark: '#854F0B' },
];

let weightData = [
  { date: '2025-05-24', w: [38.5, 32.1, 29.8] },
  { date: '2025-05-23', w: [38.2, 32.4, 30.1] },
  { date: '2025-05-22', w: [38.8, 31.9, 29.5] },
  { date: '2025-05-21', w: [37.9, 32.0, 30.0] },
  { date: '2025-05-20', w: [38.1, 32.2, 29.7] },
];

let vetData = [
  { date: '2025-04-15', cost: 4200, notes: '定期健診・体重測定・爪切り' },
];

let goalWeights = [38.0, 32.0, 30.0];
let charts = [null, null, null];
let currentColorIdx = 0;

// ── Theme ──────────────────────────────────────────────
function applyTheme(idx) {
  currentColorIdx = idx;
  const c = PASTEL_COLORS[idx];
  document.documentElement.style.setProperty('--accent', c.main);
  document.documentElement.style.setProperty('--accent-light', c.light);
  document.documentElement.style.setProperty('--accent-text', c.dark);
  document.getElementById('colorLabel').textContent = '現在：' + c.name;
  document.querySelectorAll('.color-swatch').forEach((s, i) =>
    s.classList.toggle('selected', i === idx)
  );
  if (charts[0]) refreshCharts();
}

function buildColorGrid() {
  const grid = document.getElementById('colorGrid');
  PASTEL_COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'color-swatch' + (i === 0 ? ' selected' : '');
    btn.style.background = c.main;
    btn.title = c.name;
    btn.setAttribute('aria-label', c.name);
    btn.onclick = () => applyTheme(i);
    grid.appendChild(btn);
  });
}

// ── Helpers ─────────────────────────────────────────────
function getBirdName(i) {
  return document.getElementById('name' + i)?.value || ('鳥' + (i + 1));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Weight table ─────────────────────────────────────────
function updateHeaders() {
  for (let i = 0; i < 3; i++) {
    const n = getBirdName(i);
    document.getElementById('h' + i).innerHTML =
      n + '<br><span class="unit">(g)</span>';
  }
  buildChartCards();
  if (charts[0]) refreshCharts();
}

function renderTable() {
  const body = document.getElementById('weightBody');
  body.innerHTML = '';
  const sorted = [...weightData].sort((a, b) => b.date.localeCompare(a.date));
  sorted.forEach(row => {
    const ri = weightData.indexOf(row);
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${row.date.replace(/-/g, '/')}</td>` +
      [0, 1, 2].map(i =>
        `<td><input type="number" step="0.1" value="${row.w[i] || ''}" placeholder="-"
          onchange="setWeight(${ri}, ${i}, this.value)"></td>`
      ).join('');
    body.appendChild(tr);
  });
}

function setWeight(idx, bird, val) {
  weightData[idx].w[bird] = parseFloat(val) || 0;
  if (charts[0]) refreshCharts();
}

function addRow() {
  const today = new Date().toISOString().slice(0, 10);
  weightData.unshift({ date: today, w: [null, null, null] });
  renderTable();
}

// ── Charts ───────────────────────────────────────────────
function getChartData(bi) {
  const s = [...weightData]
    .filter(r => r.w[bi] != null && r.w[bi] !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    labels: s.map(r => r.date.slice(5).replace('-', '/')),
    data: s.map(r => parseFloat(parseFloat(r.w[bi]).toFixed(1))),
  };
}

function buildChartCards() {
  const wrap = document.getElementById('chartsWrap');
  wrap.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const gv = goalWeights[i] || '';
    const name = getBirdName(i);
    wrap.innerHTML += `
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title" id="ct${i}">${name} 体重推移</div>
          <div class="goal-row">
            <span class="goal-label">目標</span>
            <input class="goal-input" type="number" step="0.1" value="${gv}"
              placeholder="--" id="goal${i}" onchange="setGoal(${i}, this.value)">
            <span class="goal-unit">g</span>
          </div>
        </div>
        <div class="legend-row">
          <span class="legend-item">
            <span class="legend-dot" style="background:${PASTEL_COLORS[currentColorIdx].main}"></span>実測
          </span>
          <span class="legend-item"><span class="legend-dash"></span>目標</span>
        </div>
        <div class="chart-wrap"><canvas id="c${i}" role="img" aria-label="${name}の体重グラフ"></canvas></div>
      </div>`;
  }
}

function setGoal(bi, val) {
  goalWeights[bi] = parseFloat(val) || null;
  refreshCharts();
}

function buildChart(id, bi) {
  const { labels, data } = getChartData(bi);
  const col = PASTEL_COLORS[currentColorIdx].main;
  const goal = goalWeights[bi];
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  const datasets = [{
    label: '実測',
    data,
    borderColor: col,
    backgroundColor: col + '28',
    borderWidth: 2,
    pointRadius: 3,
    pointBackgroundColor: col,
    fill: true,
    tension: 0.35,
  }];

  if (goal != null && !isNaN(goal) && labels.length > 0) {
    datasets.push({
      label: '目標',
      data: labels.map(() => goal),
      borderColor: '#E24B4A',
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
      tension: 0,
    });
  }

  const allVals = [...data, ...(goal ? [goal] : [])].filter(v => v != null);
  const minV = allVals.length ? Math.min(...allVals) : 0;
  const maxV = allVals.length ? Math.max(...allVals) : 50;
  const pad = Math.max((maxV - minV) * 0.3, 1);

  return new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { font: { size: 10 }, maxRotation: 45, color: '#888780' },
          grid: { display: false },
        },
        y: {
          min: parseFloat((minV - pad).toFixed(1)),
          max: parseFloat((maxV + pad).toFixed(1)),
          ticks: {
            font: { size: 10 },
            color: '#888780',
            callback: v => parseFloat(v.toFixed(1)),
          },
          grid: { color: 'rgba(136,135,128,0.15)' },
        },
      },
    },
  });
}

function refreshCharts() {
  for (let i = 0; i < 3; i++) {
    if (charts[i]) { charts[i].destroy(); charts[i] = null; }
    charts[i] = buildChart('c' + i, i);
  }
}

// ── Vet records ──────────────────────────────────────────
function renderVet() {
  const list = document.getElementById('vetList');
  const sorted = [...vetData].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = sorted.length === 0
    ? '<p style="font-size:13px;color:var(--text-secondary)">まだ記録がありません</p>'
    : '';
  sorted.forEach(v => {
    const ri = vetData.indexOf(v);
    const card = document.createElement('div');
    card.className = 'vet-card';
    card.innerHTML = `
      <div class="vet-card-header">
        <span class="vet-date"><i class="ti ti-calendar" style="font-size:13px"></i> ${v.date.replace(/-/g, '/')}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="vet-cost">¥${v.cost.toLocaleString()}</span>
          <button class="vet-del" onclick="delVet(${ri})" aria-label="削除"><i class="ti ti-x"></i></button>
        </span>
      </div>
      <div class="vet-notes">${v.notes.replace(/\n/g, '<br>')}</div>`;
    list.appendChild(card);
  });
}

function addVet() {
  const d = document.getElementById('vetDate').value;
  const c = parseInt(document.getElementById('vetCost').value) || 0;
  const n = document.getElementById('vetNotes').value.trim();
  if (!d) { showToast('日付を入力してください'); return; }
  vetData.push({ date: d, cost: c, notes: n });
  document.getElementById('vetDate').value = '';
  document.getElementById('vetCost').value = '';
  document.getElementById('vetNotes').value = '';
  renderVet();
  showToast('保存しました');
}

function delVet(idx) {
  vetData.splice(idx, 1);
  renderVet();
}

// ── Tab switching ────────────────────────────────────────
function switchTab(n) {
  document.querySelectorAll('.btab').forEach((t, i) =>
    t.classList.toggle('active', i === n)
  );
  document.querySelectorAll('.panel').forEach((p, i) =>
    p.classList.toggle('active', i === n)
  );
  if (n === 1) setTimeout(refreshCharts, 60);
}

// ── Backup ───────────────────────────────────────────────
function exportJSON() {
  const names = [0, 1, 2].map(i => getBirdName(i));
  const payload = {
    names,
    weightData,
    vetData,
    goalWeights,
    themeIdx: currentColorIdx,
    exportedAt: new Date().toISOString(),
  };
  downloadBlob(
    JSON.stringify(payload, null, 2),
    'pet_backup_' + new Date().toISOString().slice(0, 10) + '.json',
    'application/json'
  );
  showToast('JSONエクスポートしました');
}

function exportCSV() {
  const names = [0, 1, 2].map(i => getBirdName(i));
  const BOM = '\uFEFF';
  let csv = BOM;

  csv += '【体重記録】\n';
  csv += `日付,${names[0]}(g),${names[1]}(g),${names[2]}(g)\n`;
  [...weightData]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(r => {
      csv += r.date + ',' +
        [0, 1, 2].map(i =>
          r.w[i] != null && r.w[i] !== 0 ? parseFloat(r.w[i].toFixed(1)) : ''
        ).join(',') + '\n';
    });

  csv += '\n【目標体重】\n';
  csv += names.map(n => n + '目標(g)').join(',') + '\n';
  csv += goalWeights.map(g => g != null ? parseFloat(g.toFixed(1)) : '').join(',') + '\n';

  csv += '\n【通院記録】\n';
  csv += '日付,費用(円),治療・検査内容\n';
  [...vetData]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(v => {
      const notes = '"' + v.notes.replace(/"/g, '""') + '"';
      csv += `${v.date},${v.cost},${notes}\n`;
    });

  downloadBlob(
    csv,
    'pet_data_' + new Date().toISOString().slice(0, 10) + '.csv',
    'text/csv;charset=utf-8'
  );
  showToast('CSVエクスポートしました');
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (d.weightData) weightData = d.weightData;
      if (d.vetData)    vetData    = d.vetData;
      if (d.goalWeights) goalWeights = d.goalWeights;
      if (d.names) {
        d.names.forEach((n, i) => {
          const el = document.getElementById('name' + i);
          if (el) el.value = n;
        });
      }
      if (typeof d.themeIdx === 'number') applyTheme(d.themeIdx);
      updateHeaders();
      renderTable();
      renderVet();
      showToast('インポートしました');
    } catch {
      showToast('ファイルの読み込みに失敗しました');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ── Init ─────────────────────────────────────────────────
buildColorGrid();
buildChartCards();
renderTable();
renderVet();
