'use strict';

// =====================================================
// ★ここにGoogle Apps ScriptのURLを貼り付けてください★
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzr9HPjLCASNLLEza_pzS5nYixHAUiK6fvLPvsQPpccNn09ROFaQ-bokJ39txQhZ_Jk/exec';
// =====================================================

const PASTEL_COLORS = [
  { name: 'ラベンダー',   main: '#7F77DD', light: '#EEEDFE', dark: '#3C3489' },
  { name: 'ミント',       main: '#5DCAA5', light: '#E1F5EE', dark: '#085041' },
  { name: 'スカイ',       main: '#85B7EB', light: '#E6F1FB', dark: '#0C447C' },
  { name: 'コーラル',     main: '#F0997B', light: '#FAECE7', dark: '#712B13' },
  { name: 'ローズ',       main: '#ED93B1', light: '#FBEAF0', dark: '#72243E' },
  { name: 'ピーチ',       main: '#FAC775', light: '#FAEEDA', dark: '#633806' },
  { name: 'ライム',       main: '#97C459', light: '#EAF3DE', dark: '#27500A' },
  { name: 'ベビーブルー', main: '#B5D4F4', light: '#E6F1FB', dark: '#185FA5' },
  { name: 'サーモン',     main: '#F5C4B3', light: '#FAECE7', dark: '#993C1D' },
  { name: 'ライラック',   main: '#AFA9EC', light: '#EEEDFE', dark: '#534AB7' },
  { name: 'アクア',       main: '#9FE1CB', light: '#E1F5EE', dark: '#0F6E56' },
  { name: 'バター',       main: '#EF9F27', light: '#FAEEDA', dark: '#854F0B' },
];

let weightData  = [];
let vetData     = [];
let goalWeights = [null, null, null];
let charts      = [null, null, null];
let currentColorIdx = 0;
let collapsedYears  = new Set();
let pendingDelete   = null;

// ── Date helpers
// タイムゾーンをJSTに合わせた今日の日付を返す
function todayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

 ─────────────────────────────────────────
// GASから "2026-05-24" や "2026-05-24T15:00:00.000Z" で返ることがある
function normalizeISO(val) {
  if (!val) return null;
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function toDisplay(iso) {
  const s = normalizeISO(iso) || String(iso);
  const p = s.split('-');
  return p[0].slice(2) + '/' + p[1] + '/' + p[2];
}

function toISO(disp) {
  const p = disp.replace(/-/g, '/').split('/');
  if (p.length !== 3) return null;
  let [y, m, d] = p;
  if (y.length === 2) y = '20' + y;
  if (y.length !== 4) return null;
  const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  return isNaN(Date.parse(iso)) ? null : iso;
}

// ── Dialog ────────────────────────────────────────────────
function askDelete(type, idx, msg) {
  pendingDelete = { type, idx };
  document.getElementById('dialogMsg').textContent = msg;
  document.getElementById('dialogOverlay').classList.add('show');
}

function closeDialog() {
  pendingDelete = null;
  document.getElementById('dialogOverlay').classList.remove('show');
}

function confirmDelete() {
  if (!pendingDelete) return;
  const { type, idx } = pendingDelete;
  closeDialog();
  if (type === 'row') {
    weightData.splice(idx, 1);
    renderTable();
    if (charts[0]) refreshCharts();
    saveAll();
  } else if (type === 'vet') {
    vetData.splice(idx, 1);
    renderVet();
    saveAll();
  }
}

// ── API ──────────────────────────────────────────────────
async function apiLoad() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(GAS_URL + '?action=load', {
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function apiSave(data) {
  await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'save', data }),
  });
}

function buildSavePayload() {
  return {
    weightData,
    vetData,
    config: {
      names:       [0,1,2].map(i => getBirdName(i)),
      goalWeights,
      themeIdx:    currentColorIdx,
    },
  };
}

async function saveAll() {
  try {
    await apiSave(buildSavePayload());
  } catch {
    showToast('保存に失敗しました');
  }
}

// ── Init ─────────────────────────────────────────────────
async function init() {
  showLoading(true);
  buildColorGrid();

  try {
    const d = await apiLoad();
    if (d.weightData) weightData = d.weightData;
    if (d.vetData)    vetData    = d.vetData;
    if (d.config) {
      if (d.config.names) {
        d.config.names.forEach((n, i) => {
          const el = document.getElementById('name' + i);
          if (el) el.value = n || '';
        });
      }
      if (d.config.goalWeights) goalWeights = d.config.goalWeights;
      if (typeof d.config.themeIdx === 'number') applyTheme(d.config.themeIdx);
    }
  } catch (e) {
    showToast('データの読み込みに失敗しました（オフライン？）');
  }

  showLoading(false);
  buildChartCards();
  renderTable();
  renderVet();
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

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
    btn.onclick = () => { applyTheme(i); saveAll(); };
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
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Weight table ─────────────────────────────────────────
function onNameInput() {
  buildChartCards();
  if (charts[0]) refreshCharts();
  renderTable();
  saveAll();
}

function updateHeaders() {
  buildChartCards();
  if (charts[0]) refreshCharts();
  renderTable();
}

function toggleYear(year) {
  const currentYear = String(new Date().getFullYear());
  const defaultOpen = year === currentYear;
  const manualOpen  = collapsedYears.has('open:' + year);
  const manualClose = collapsedYears.has('close:' + year);
  const nowOpen = manualOpen ? true : manualClose ? false : defaultOpen;
  // トグル
  collapsedYears.delete('open:' + year);
  collapsedYears.delete('close:' + year);
  if (nowOpen) {
    collapsedYears.add('close:' + year);
  } else {
    collapsedYears.add('open:' + year);
  }
  renderTable();
}

function renderTable() {
  const wrap = document.getElementById('weightGroups');
  wrap.innerHTML = '';

  const byYear = {};
  weightData.forEach((row, ri) => {
    const y = row.date.slice(0, 4);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push({ row, ri });
  });

  const years = Object.keys(byYear).sort((a, b) => b - a);
  const currentYear = String(new Date().getFullYear());

  years.forEach(year => {
    const rows   = byYear[year].sort((a, b) => b.row.date.localeCompare(a.row.date));
    // 今年はデフォルトで開く。前年以前はデフォルトで折り畳む。
    // ユーザーが手動でトグルした年は collapsedYears で管理。
    let isOpen;
    if (collapsedYears.has('open:' + year)) {
      isOpen = true;  // 手動で開いた
    } else if (collapsedYears.has('close:' + year)) {
      isOpen = false; // 手動で閉じた
    } else {
      isOpen = year === currentYear; // デフォルト：今年のみ開く
    }
    const group  = document.createElement('div');
    group.className = 'year-group';

    const hdr = document.createElement('div');
    hdr.className = 'year-header';
    hdr.onclick = () => toggleYear(year);
    hdr.innerHTML = `
      <span class="year-label">${year}年</span>
      <span style="display:flex;align-items:center;gap:8px">
        <span class="year-meta">${rows.length}件</span>
        <i class="ti ti-chevron-down year-chevron ${isOpen ? 'open' : ''}"></i>
      </span>`;
    group.appendChild(hdr);

    const body = document.createElement('div');
    body.className = 'year-body' + (isOpen ? '' : ' collapsed');

    const names = [0,1,2].map(i => getBirdName(i));
    const tbl   = document.createElement('table');
    // 日付:54px 体重3列:auto 削除:22px
    tbl.innerHTML = `
      <colgroup><col style="width:54px"><col><col><col><col style="width:22px"></colgroup>
      <thead><tr>
        <th>日付</th>
        <th>${names[0]}<br><span class="unit">(g)</span></th>
        <th>${names[1]}<br><span class="unit">(g)</span></th>
        <th>${names[2]}<br><span class="unit">(g)</span></th>
        <th></th>
      </tr></thead>`;

    const tbody = document.createElement('tbody');
    rows.forEach(({ row, ri }) => {
      const disp = toDisplay(row.date);
      const tr   = document.createElement('tr');
      tr.innerHTML =
        `<td>
          <span class="date-display" id="dd-${ri}" onclick="startEditDate(${ri})">${disp}</span>
          <input class="date-edit" id="de-${ri}" type="text" value="${disp}" placeholder="yy/mm/dd"
            onblur="commitDate(${ri})" onkeydown="if(event.key==='Enter')this.blur()">
        </td>` +
        [0,1,2].map(i =>
          `<td><input type="number" step="0.1" value="${row.w[i] || ''}" placeholder="-"
            onchange="setWeight(${ri}, ${i}, this.value)"></td>`
        ).join('') +
        `<td><button class="del-btn" onclick="askDelete('row', ${ri}, '${disp} のデータを削除します')" aria-label="削除">
          <i class="ti ti-trash"></i>
        </button></td>`;
      tbody.appendChild(tr);
    });

    tbl.appendChild(tbody);
    body.appendChild(tbl);
    group.appendChild(body);
    wrap.appendChild(group);

    body.style.maxHeight = isOpen ? (body.scrollHeight + 200) + 'px' : '0px';
  });
}

function startEditDate(ri) {
  document.getElementById('dd-' + ri)?.classList.add('hidden');
  const inp = document.getElementById('de-' + ri);
  if (!inp) return;
  inp.classList.add('active');
  inp.focus();
  inp.select();
}

function commitDate(ri) {
  const inp  = document.getElementById('de-' + ri);
  if (!inp) return;
  const iso  = toISO(inp.value.trim());
  const warn = document.getElementById('dupWarning');
  if (!iso) {
    inp.value = toDisplay(weightData[ri].date);
  } else if (weightData.some((r, i) => i !== ri && r.date === iso)) {
    warn.style.display = 'block';
    inp.value = toDisplay(weightData[ri].date);
  } else {
    warn.style.display = 'none';
    weightData[ri].date = iso;
    saveAll();
  }
  inp.classList.remove('active');
  renderTable();
}

function setWeight(idx, bird, val) {
  weightData[idx].w[bird] = parseFloat(val) || 0;
  if (charts[0]) refreshCharts();
  saveAll();
}

function addRow() {
  const today = todayJST();
  const warn  = document.getElementById('dupWarning');
  if (weightData.some(r => r.date === today)) { warn.style.display = 'block'; return; }
  warn.style.display = 'none';
  weightData.unshift({ date: today, w: [null, null, null] });
  // 行追加時は今年を強制的に開く
  collapsedYears.delete('close:' + today.slice(0, 4));
  renderTable();
  saveAll().catch(() => {}); // 保存失敗してもUIは止めない
}

// ── Charts ───────────────────────────────────────────────
function getChartData(bi) {
  const s = [...weightData]
    .filter(r => r.w[bi] != null && r.w[bi] !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    labels: s.map(r => r.date.slice(5).replace('-', '/')),
    data:   s.map(r => parseFloat(parseFloat(r.w[bi]).toFixed(1))),
  };
}

function buildChartCards() {
  const wrap = document.getElementById('chartsWrap');
  wrap.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const gv   = goalWeights[i] || '';
    const name = getBirdName(i);
    wrap.innerHTML += `
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title">${name} 体重推移</div>
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
  saveAll();
}

function buildChart(id, bi) {
  const { labels, data } = getChartData(bi);
  const col  = PASTEL_COLORS[currentColorIdx].main;
  const goal = goalWeights[bi];
  const ctx  = document.getElementById(id);
  if (!ctx) return null;

  const datasets = [{
    label: '実測', data,
    borderColor: col, backgroundColor: col + '28',
    borderWidth: 2, pointRadius: 0, pointHoverRadius: 0,
    fill: true, tension: 0,
  }];

  if (goal != null && !isNaN(goal) && labels.length > 0) {
    datasets.push({
      label: '目標', data: labels.map(() => goal),
      borderColor: '#E24B4A', borderWidth: 1.5, borderDash: [5, 4],
      pointRadius: 0, fill: false, tension: 0,
    });
  }

  const allVals = [...data, ...(goal ? [goal] : [])].filter(v => v != null);
  const minV = allVals.length ? Math.min(...allVals) : 0;
  const maxV = allVals.length ? Math.max(...allVals) : 50;
  const pad  = Math.max((maxV - minV) * 0.3, 1);

  return new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 45, color: '#888780' }, grid: { display: false } },
        y: {
          min: parseFloat((minV - pad).toFixed(1)),
          max: parseFloat((maxV + pad).toFixed(1)),
          ticks: { font: { size: 10 }, color: '#888780', callback: v => parseFloat(v.toFixed(1)) },
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
  const list   = document.getElementById('vetList');
  const sorted = [...vetData].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = sorted.length === 0
    ? '<p style="font-size:13px;color:var(--text-secondary)">まだ記録がありません</p>' : '';
  sorted.forEach(v => {
    const ri       = vetData.indexOf(v);
    const safeDate = v.date.replace(/-/g, '/');
    const card     = document.createElement('div');
    card.className = 'vet-card';
    card.innerHTML = `
      <div class="vet-card-header">
        <span class="vet-date"><i class="ti ti-calendar" style="font-size:13px"></i> ${safeDate}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="vet-cost">¥${v.cost.toLocaleString()}</span>
          <button class="vet-del" onclick="askDelete('vet', ${ri}, '${safeDate} の通院記録を削除します')" aria-label="削除">
            <i class="ti ti-x"></i>
          </button>
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
  document.getElementById('vetDate').value  = '';
  document.getElementById('vetCost').value  = '';
  document.getElementById('vetNotes').value = '';
  renderVet();
  saveAll();
  showToast('保存しました');
}

// ── Tab switching ────────────────────────────────────────
function switchTab(n) {
  document.querySelectorAll('.btab').forEach((t, i) => t.classList.toggle('active', i === n));
  document.querySelectorAll('.panel').forEach((p, i) => p.classList.toggle('active', i === n));
  if (n === 1) setTimeout(refreshCharts, 60);
}

// ── CSV Export ───────────────────────────────────────────
function exportCSV() {
  const names = [0,1,2].map(i => getBirdName(i));
  const BOM   = '\uFEFF';
  let csv = BOM;

  csv += '【体重記録】\n';
  csv += `日付,${names[0]}(g),${names[1]}(g),${names[2]}(g)\n`;
  [...weightData].sort((a, b) => b.date.localeCompare(a.date)).forEach(r => {
    csv += r.date + ',' + [0,1,2].map(i =>
      r.w[i] != null && r.w[i] !== 0 ? parseFloat(r.w[i].toFixed(1)) : ''
    ).join(',') + '\n';
  });

  csv += '\n【目標体重】\n';
  csv += names.map(n => n + '目標(g)').join(',') + '\n';
  csv += goalWeights.map(g => g != null ? parseFloat(g.toFixed(1)) : '').join(',') + '\n';

  csv += '\n【通院記録】\n日付,費用(円),治療・検査内容\n';
  [...vetData].sort((a, b) => b.date.localeCompare(a.date)).forEach(v => {
    csv += `${v.date},${v.cost},"${v.notes.replace(/"/g, '""')}"\n`;
  });

  downloadBlob(csv, 'pet_data_' + todayJST() + '.csv', 'text/csv;charset=utf-8');
  showToast('CSVエクスポートしました');
}

// ── Start ─────────────────────────────────────────────────
init();
