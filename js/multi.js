// ============================================================
// 云霄直流PTR沙盘系统 — 多时段推演模块（三栏布局）
// ============================================================
import { SCENARIOS, BID_MIN, BID_MAX, P_FJ_CONTRACT, C_LOSS, generateMonthlyData, generateAIBids } from './data.js';
import { runMCPClearing, calcSettlement, calcATC, calcRationalBid } from './engine.js';
import { initCompactTopology, updateTopology, renderDispatchResult } from './topology.js';

let currentScenario = 'flat';
let timeMode = 'daily';
let bidPrices = [];
let clearResults = [];

export function initMulti(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = buildHTML();
  initCompactTopology('multi-topo-svg');
  bindEvents();
  initBids();
  renderChart();
  renderBidTable();
  updateDispatchSummary();
}

function buildHTML() {
  return `
    <div class="three-col-layout">
      <!-- 左栏：策略 + 报价表 + 出清按钮 -->
      <div class="flex flex-col gap-3">
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>推演控制</h2>
          </div>
          <div class="panel-body">
            <div class="flex gap-1 mb-2">
              <button id="multi-daily" class="btn btn-xs btn-outline active" style="flex:1;">日前24时段</button>
              <button id="multi-monthly" class="btn btn-xs btn-outline" style="flex:1;">月度31天</button>
            </div>
            <div class="text-xs font-semibold text-muted uppercase mb-1">快捷策略</div>
            <div class="flex flex-col gap-1 mb-2">
              <button id="btn-upper" class="btn btn-xs btn-outline">一键上限 (100元)</button>
              <button id="btn-lower" class="btn btn-xs btn-outline">一键下限 (25.6元)</button>
              <button id="btn-rational" class="btn btn-xs btn-outline">理性对冲算法</button>
            </div>
            <button id="multi-run" class="btn btn-success btn-sm w-full">开始批量出清</button>
          </div>
        </div>

        <div class="panel" style="flex:1;">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>分时报价表</h2>
          </div>
          <div class="panel-body" style="padding:0;overflow:auto;max-height:500px;">
            <div id="multi-bid-table"></div>
          </div>
        </div>
      </div>

      <!-- 中栏：场景 + 拓扑 + 图表 -->
      <div class="flex flex-col gap-3">
        <!-- 场景参数 -->
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>场景参数</h2>
            <span id="multi-scenario-badge" class="badge badge-primary">平枯普通</span>
          </div>
          <div class="panel-body">
            <div class="grid-3" id="multi-scene-info"></div>
          </div>
        </div>

        <!-- 拓扑图 + 调度汇总 -->
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>物理拓扑 · 调度联动</h2>
            <span id="multi-topo-badge" class="badge badge-success">正常</span>
          </div>
          <div class="panel-body" style="padding:4px;">
            <div id="multi-topo-svg"></div>
            <div id="multi-dispatch" class="mt-2" style="padding:0 4px;">
              <div class="text-xs text-muted">批量出清后显示调度汇总</div>
            </div>
          </div>
        </div>

        <!-- 双轴折线图 -->
        <div class="panel" style="flex:1;min-height:280px;">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>价格趋势与ATC</h2>
          </div>
          <div class="panel-body" style="padding:8px;">
            <div id="multi-chart-container" style="width:100%;height:260px;"></div>
          </div>
        </div>
      </div>

      <!-- 右栏：汇总账单 -->
      <div class="panel">
        <div class="panel-header">
          <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>周期汇总账单</h2>
        </div>
        <div class="panel-body" id="multi-summary">
          <div class="text-center text-muted" style="padding:60px 0;">
            <div style="font-size:24px;margin-bottom:8px;">📈</div>
            <div class="text-sm">批量出清后查看汇总</div>
          </div>
        </div>
      </div>
    </div>`;
}

function bindEvents() {
  document.getElementById('multi-daily')?.addEventListener('click', () => switchTimeMode('daily'));
  document.getElementById('multi-monthly')?.addEventListener('click', () => switchTimeMode('monthly'));
  document.getElementById('btn-upper')?.addEventListener('click', () => fillAll(BID_MAX));
  document.getElementById('btn-lower')?.addEventListener('click', () => fillAll(BID_MIN));
  document.getElementById('btn-rational')?.addEventListener('click', fillRational);
  document.getElementById('multi-run')?.addEventListener('click', runBatchClearing);
}

function switchTimeMode(mode) {
  timeMode = mode;
  document.getElementById('multi-daily')?.classList.toggle('active', mode === 'daily');
  document.getElementById('multi-monthly')?.classList.toggle('active', mode === 'monthly');
  initBids();
  renderChart();
  renderBidTable();
  clearResults = [];
  updateSummary();
  updateDispatchSummary();
}

function initBids() {
  const count = timeMode === 'daily' ? 24 : 31;
  bidPrices = Array(count).fill(65);
}

function fillAll(price) {
  bidPrices = bidPrices.map(() => price);
  renderBidTable();
  renderChart();
}

function fillRational() {
  const s = SCENARIOS[currentScenario];
  if (timeMode === 'daily') {
    bidPrices = s.gd_spot.map(gd => calcRationalBid(gd));
  } else {
    const monthly = generateMonthlyData(currentScenario);
    bidPrices = monthly.map(day => {
      const avgGd = day.gd_spot.reduce((a, b) => a + b, 0) / 24;
      return calcRationalBid(avgGd);
    });
  }
  renderBidTable();
  renderChart();
}

export function setMultiScenario(s) {
  currentScenario = s;
  const badge = document.getElementById('multi-scenario-badge');
  if (badge) badge.textContent = SCENARIOS[s].name;
  initBids();
  clearResults = [];
  renderChart();
  renderBidTable();
  updateSummary();
  updateDispatchSummary();
  updateSceneInfo();
  updateTopology(s, false, null);
}

function updateSceneInfo() {
  const s = SCENARIOS[currentScenario];
  const atcInfo = calcATC(currentScenario, 12);
  const info = document.getElementById('multi-scene-info');
  if (info) {
    const avgFj = Math.round(s.fj_spot.reduce((a,b)=>a+b,0)/24);
    const avgGd = Math.round(s.gd_spot.reduce((a,b)=>a+b,0)/24);
    info.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">日均福建现货</div><div class="kpi-value">${avgFj}<span class="kpi-unit">元</span></div></div>
      <div class="kpi-card"><div class="kpi-label">日均广东现货</div><div class="kpi-value">${avgGd}<span class="kpi-unit">元</span></div></div>
      <div class="kpi-card"><div class="kpi-label">通道 ATC</div><div class="kpi-value">${atcInfo.atc}<span class="kpi-unit">MW</span></div></div>`;
  }
}

function renderBidTable() {
  const container = document.getElementById('multi-bid-table');
  if (!container) return;
  const s = SCENARIOS[currentScenario];
  const count = bidPrices.length;
  const monthly = timeMode === 'monthly' ? generateMonthlyData(currentScenario) : null;

  let rows = '';
  for (let i = 0; i < count; i++) {
    const label = timeMode === 'daily' ? `${String(i).padStart(2, '0')}:00` : `第${i + 1}天`;
    const fjSpot = timeMode === 'daily' ? s.fj_spot[i] : monthly[i].fj_spot.reduce((a,b)=>a+b,0)/24;
    const gdSpot = timeMode === 'daily' ? s.gd_spot[i] : monthly[i].gd_spot.reduce((a,b)=>a+b,0)/24;
    const hour = timeMode === 'daily' ? i : 12;
    const atcInfo = calcATC(currentScenario, hour);
    const curAtc = timeMode === 'daily' ? atcInfo.atc : monthly[i].atc;
    const won = clearResults.length > i ? clearResults[i]?.result.isUserWon : null;
    const wonBadge = won === null ? '' : won ? '<span class="badge badge-success">中标</span>' : '<span class="badge badge-error">落标</span>';

    rows += `<tr>
      <td style="font-family:var(--font);font-size:11px;">${label}</td>
      <td>${Math.round(fjSpot)}</td>
      <td>${Math.round(gdSpot)}</td>
      <td>${curAtc}</td>
      <td><input type="number" class="input" style="width:70px;padding:2px 4px;font-size:11px;" value="${bidPrices[i]}" min="${BID_MIN}" max="${BID_MAX}" step="0.1" data-idx="${i}"/></td>
      <td>${wonBadge}</td>
    </tr>`;
  }

  container.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>${timeMode === 'daily' ? '时段' : '天'}</th><th>闽价</th><th>粤价</th><th>ATC</th><th>报价</th><th>结果</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  container.querySelectorAll('input[type="number"]').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.idx);
      let v = parseFloat(e.target.value);
      if (isNaN(v)) v = BID_MIN;
      v = Math.max(BID_MIN, Math.min(BID_MAX, v));
      bidPrices[idx] = v;
      renderChart();
    });
  });
}

function runBatchClearing() {
  const count = bidPrices.length;
  clearResults = [];
  const monthly = timeMode === 'monthly' ? generateMonthlyData(currentScenario) : null;

  for (let i = 0; i < count; i++) {
    const hour = timeMode === 'daily' ? i : 12;
    const atcInfo = calcATC(currentScenario, hour);
    const curAtc = timeMode === 'daily' ? atcInfo.atc : monthly[i].atc;
    const aiBids = generateAIBids(currentScenario, hour);
    const result = runMCPClearing(bidPrices[i], 100, curAtc, aiBids);
    const settlement = calcSettlement(result, currentScenario, hour);
    clearResults.push({ result, settlement });
  }

  renderBidTable();
  renderChart();
  updateSummary();
  updateDispatchSummary();

  // 更新拓扑联动（用最后一个时段的结果）
  const last = clearResults[clearResults.length - 1];
  updateTopology(currentScenario, last.result.isUserWon, last.result);

  const topoBadge = document.getElementById('multi-topo-badge');
  if (topoBadge) {
    const wonCount = clearResults.filter(r => r.result.isUserWon).length;
    topoBadge.textContent = `${wonCount}/${count} 中标`;
    topoBadge.className = wonCount > 0 ? 'badge badge-success' : 'badge badge-error';
  }
}

function updateDispatchSummary() {
  const el = document.getElementById('multi-dispatch');
  if (!el) return;
  if (clearResults.length === 0) {
    el.innerHTML = '<div class="text-xs text-muted">批量出清后显示调度汇总</div>';
    return;
  }
  const wonCount = clearResults.filter(r => r.result.isUserWon).length;
  const totalCount = clearResults.length;
  const avgMcp = clearResults.filter(r => r.result.isUserWon).length > 0
    ? (clearResults.filter(r => r.result.isUserWon).reduce((s,r) => s + r.result.mcpPrice, 0) / clearResults.filter(r => r.result.isUserWon).length).toFixed(1)
    : '--';

  el.innerHTML = `
    <div class="text-xs font-semibold text-muted uppercase mb-1">多时段调度汇总</div>
    <div class="grid-3" style="gap:4px;">
      <div class="card" style="padding:4px 6px;text-align:center;">
        <div class="text-xs text-muted">中标率</div>
        <div class="mono font-semibold text-ink">${(wonCount/totalCount*100).toFixed(0)}%</div>
      </div>
      <div class="card" style="padding:4px 6px;text-align:center;">
        <div class="text-xs text-muted">平均出清价</div>
        <div class="mono font-semibold text-warning">${avgMcp}</div>
      </div>
      <div class="card" style="padding:4px 6px;text-align:center;">
        <div class="text-xs text-muted">中标/总计</div>
        <div class="mono font-semibold text-ink">${wonCount}/${totalCount}</div>
      </div>
    </div>`;
}

function updateSummary() {
  const el = document.getElementById('multi-summary');
  if (!el) return;
  if (clearResults.length === 0) {
    el.innerHTML = '<div class="text-center text-muted" style="padding:60px 0;"><div style="font-size:24px;margin-bottom:8px;">📈</div><div class="text-sm">批量出清后查看汇总</div></div>';
    return;
  }

  const totalQty = clearResults.reduce((sum, r) => sum + r.result.userWinQty, 0);
  const totalRevenue = clearResults.reduce((sum, r) => sum + (r.settlement.spotRevenue || 0), 0);
  const totalCost = clearResults.reduce((sum, r) => sum + (r.settlement.totalCost || 0), 0);
  const totalProfit = clearResults.reduce((sum, r) => sum + r.settlement.netProfit, 0);
  const wonCount = clearResults.filter(r => r.result.isUserWon).length;
  const totalCount = clearResults.length;

  el.innerHTML = `
    <div class="flex flex-col gap-2 animate-fade">
      <div class="kpi-card"><div class="kpi-label">中标时段/天</div><div class="kpi-value">${wonCount}<span class="kpi-unit">/ ${totalCount}</span></div></div>
      <div class="kpi-card"><div class="kpi-label">累计中标电量</div><div class="kpi-value">${totalQty.toFixed(0)}<span class="kpi-unit">MWh</span></div></div>
      <div class="kpi-card"><div class="kpi-label">累计现货收益</div><div class="kpi-value">${totalRevenue.toFixed(0)}<span class="kpi-unit">元</span></div></div>
      <div class="kpi-card"><div class="kpi-label">累计综合成本</div><div class="kpi-value">${totalCost.toFixed(0)}<span class="kpi-unit">元</span></div></div>
      <div class="kpi-card" style="border:2px solid ${totalProfit >= 0 ? 'var(--success)' : 'var(--error)'};">
        <div class="kpi-label">周期总净损益</div>
        <div class="kpi-value ${totalProfit >= 0 ? 'positive' : 'negative'}">${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)}<span class="kpi-unit">元</span></div>
      </div>
      <div class="text-xs text-muted mt-2">
        中标率: <span class="mono font-semibold">${(wonCount/totalCount*100).toFixed(1)}%</span><br/>
        平均中标价: <span class="mono">${clearResults.filter(r=>r.result.isUserWon).length > 0 ? (clearResults.filter(r=>r.result.isUserWon).reduce((s,r)=>s+r.result.mcpPrice,0)/clearResults.filter(r=>r.result.isUserWon).length).toFixed(1) : '--'}</span> 元/MWh
      </div>
    </div>`;
}

function renderChart() {
  const container = document.getElementById('multi-chart-container');
  if (!container) return;
  const w = container.clientWidth;
  const h = 260;
  const s = SCENARIOS[currentScenario];
  const count = bidPrices.length;
  const monthly = timeMode === 'monthly' ? generateMonthlyData(currentScenario) : null;

  const fjData = timeMode === 'daily' ? s.fj_spot : monthly.map(d => d.fj_spot.reduce((a,b)=>a+b,0)/24);
  const gdData = timeMode === 'daily' ? s.gd_spot : monthly.map(d => d.gd_spot.reduce((a,b)=>a+b,0)/24);

  // 获取每个时段的ATC
  const atcData = [];
  for (let i = 0; i < count; i++) {
    const hour = timeMode === 'daily' ? i : 12;
    const atcInfo = calcATC(currentScenario, hour);
    atcData.push(timeMode === 'daily' ? atcInfo.atc : monthly[i].atc);
  }

  const allPrices = [...fjData, ...gdData, ...bidPrices];
  const minP = Math.min(...allPrices) - 20;
  const maxP = Math.max(...allPrices) + 20;
  const maxAtc = Math.max(...atcData) + 200;

  const padL = 50, padR = 50, padT = 20, padB = 30;
  const cw = w - padL - padR;
  const ch = h - padT - padB;
  const stepX = cw / (count - 1 || 1);

  function priceY(p) { return padT + ch - ((p - minP) / (maxP - minP)) * ch; }
  function atcY(v) { return padT + ch - (v / maxAtc) * ch; }
  function linePath(data) {
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'}${padL + i * stepX},${priceY(v)}`).join(' ');
  }

  const atcBars = atcData.map((v, i) => {
    const x = padL + i * stepX - stepX * 0.3;
    const bw = stepX * 0.6;
    const y = atcY(v);
    const bh = padT + ch - y;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#2563eb" opacity="0.08" rx="2"/>`;
  }).join('');

  const xLabels = Array.from({length: count}, (_, i) => {
    if (count > 24 && i % 5 !== 0 && i !== count - 1) return '';
    const label = timeMode === 'daily' ? `${String(i).padStart(2, '0')}` : `${i + 1}`;
    return `<text x="${padL + i * stepX}" y="${h - 6}" text-anchor="middle" font-size="9" fill="#94a3b8">${label}</text>`;
  }).join('');

  const ySteps = 5;
  const yLabels = Array.from({length: ySteps + 1}, (_, i) => {
    const p = minP + (maxP - minP) * (i / ySteps);
    return `<text x="${padL - 6}" y="${priceY(p) + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${Math.round(p)}</text>
            <line x1="${padL}" y1="${priceY(p)}" x2="${padL + cw}" y2="${priceY(p)}" stroke="#f1f5f9" stroke-width="1"/>`;
  }).join('');

  const atcLabels = Array.from({length: 3}, (_, i) => {
    const v = maxAtc * (i / 2);
    return `<text x="${padL + cw + 6}" y="${atcY(v) + 3}" font-size="9" fill="#94a3b8">${Math.round(v)}</text>`;
  }).join('');

  // 中标/落标标记
  const resultMarkers = clearResults.length > 0 ? clearResults.map((r, i) => {
    const x = padL + i * stepX;
    const color = r.result.isUserWon ? '#10b981' : '#ef4444';
    return `<circle cx="${x}" cy="${h - 16}" r="3" fill="${color}" opacity="0.7"/>`;
  }).join('') : '';

  container.innerHTML = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${yLabels}
      ${atcBars}
      ${xLabels}
      ${atcLabels}
      <path d="${linePath(fjData)}" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.7"/>
      <path d="${linePath(gdData)}" fill="none" stroke="#ef4444" stroke-width="2" opacity="0.7"/>
      <path d="${linePath(bidPrices)}" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="6 3"/>
      ${bidPrices.map((v, i) => `<circle cx="${padL + i * stepX}" cy="${priceY(v)}" r="3" fill="#10b981" stroke="white" stroke-width="1.5"/>`).join('')}
      ${resultMarkers}
      <g transform="translate(${padL + 4}, ${padT + 8})">
        <line x1="0" y1="0" x2="16" y2="0" stroke="#ef4444" stroke-width="2"/><text x="20" y="3" font-size="9" fill="#64748b">广东现货</text>
        <line x1="70" y1="0" x2="86" y2="0" stroke="#3b82f6" stroke-width="2"/><text x="90" y="3" font-size="9" fill="#64748b">福建现货</text>
        <line x1="140" y1="0" x2="156" y2="0" stroke="#10b981" stroke-width="2" stroke-dasharray="4 2"/><text x="160" y="3" font-size="9" fill="#64748b">您的报价</text>
        <rect x="210" y="-4" width="10" height="8" fill="#2563eb" opacity="0.1" rx="1"/><text x="224" y="3" font-size="9" fill="#64748b">ATC</text>
      </g>
    </svg>`;
}
