// ============================================================
// 云霄直流PTR沙盘系统 — 多时段推演模块（三栏布局）
// ============================================================
import { SCENARIOS, BID_MIN, BID_MAX, P_FJ_CONTRACT, C_LOSS, generateMonthlyData, generateAIBids } from './data.js';
import { runMCPClearing, calcSettlement, calcATC, calcRationalBid } from './engine.js';
import { initCompactTopology, updateTopology, renderDispatchResult } from './topology.js';
import { calcRiskDimensions, renderRadarChart, getRiskLevel } from './risk-assessment.js';
import { generateCalendarData, renderCalendarGrid, calcBreakEvenAnalysis } from './calendar.js';

let currentScenario = 'flat';
let timeMode = 'daily';
let bidPrices = [];
let clearResults = [];
let calendarData = null;

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
              <button id="multi-calendar" class="btn btn-xs btn-outline" style="flex:1;">📅 日历视图</button>
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

        <div class="panel" style="flex:1;" id="multi-bid-panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>分时报价表</h2>
          </div>
          <div class="panel-body" style="padding:0;overflow:auto;max-height:500px;">
            <div id="multi-bid-table"></div>
          </div>
        </div>
      </div>

      <!-- 中栏：场景 + 拓扑 + 图表 OR 日历 -->
      <div class="flex flex-col gap-3" id="multi-center-col">
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
        <div class="panel" id="multi-topo-panel">
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

        <!-- 双轴折线图 OR 日历网格 -->
        <div class="panel mid-chart-panel" id="multi-chart-panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg><span id="multi-chart-title">价格趋势与ATC</span></h2>
          </div>
          <div class="panel-body">
            <div id="multi-chart-container" class="mid-chart-area"></div>
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
  document.getElementById('multi-calendar')?.addEventListener('click', () => switchTimeMode('calendar'));
  document.getElementById('btn-upper')?.addEventListener('click', () => fillAll(BID_MAX));
  document.getElementById('btn-lower')?.addEventListener('click', () => fillAll(BID_MIN));
  document.getElementById('btn-rational')?.addEventListener('click', fillRational);
  document.getElementById('multi-run')?.addEventListener('click', runBatchClearing);
}

function switchTimeMode(mode) {
  timeMode = mode;
  document.getElementById('multi-daily')?.classList.toggle('active', mode === 'daily');
  document.getElementById('multi-monthly')?.classList.toggle('active', mode === 'monthly');
  document.getElementById('multi-calendar')?.classList.toggle('active', mode === 'calendar');

  if (mode === 'calendar') {
    // 切换到日历视图
    showCalendarView();
  } else {
    // 恢复普通视图
    hideCalendarView();
    initBids();
    renderChart();
    renderBidTable();
    clearResults = [];
    updateSummary();
    updateDispatchSummary();
  }
}

function showCalendarView() {
  // 隐藏报价表和拓扑图
  const bidPanel = document.getElementById('multi-bid-panel');
  const topoPanel = document.getElementById('multi-topo-panel');
  if (bidPanel) bidPanel.style.display = 'none';
  if (topoPanel) topoPanel.style.display = 'none';

  // 生成日历数据
  calendarData = generateCalendarData(currentScenario, 6, 2026);

  // 渲染日历
  const chartContainer = document.getElementById('multi-chart-container');
  const chartTitle = document.getElementById('multi-chart-title');
  if (chartTitle) chartTitle.textContent = '月度交易日历';
  if (chartContainer) {
    chartContainer.style.height = 'auto';
    chartContainer.innerHTML = renderCalendarGrid(calendarData, 700);
  }

  // 渲染盈亏平衡分析
  const breakEvenAnalysis = calcBreakEvenAnalysis(calendarData, 65, 100);
  renderBreakEvenAnalysis(breakEvenAnalysis);
}

function hideCalendarView() {
  const bidPanel = document.getElementById('multi-bid-panel');
  const topoPanel = document.getElementById('multi-topo-panel');
  if (bidPanel) bidPanel.style.display = 'flex';
  if (topoPanel) topoPanel.style.display = 'block';

  const chartTitle = document.getElementById('multi-chart-title');
  if (chartTitle) chartTitle.textContent = '价格趋势与ATC';

  const chartContainer = document.getElementById('multi-chart-container');
  if (chartContainer) chartContainer.style.height = '';
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
    <div style="display:flex;gap:8px;align-items:center;">
      <div class="card" style="padding:4px 8px;flex:1;display:flex;justify-content:space-between;align-items:center;">
        <span class="text-xs text-muted">中标率</span>
        <span class="mono font-semibold text-ink">${(wonCount/totalCount*100).toFixed(0)}%</span>
      </div>
      <div class="card" style="padding:4px 8px;flex:1;display:flex;justify-content:space-between;align-items:center;">
        <span class="text-xs text-muted">平均出清价</span>
        <span class="mono font-semibold text-warning">${avgMcp}</span>
      </div>
      <div class="card" style="padding:4px 8px;flex:1;display:flex;justify-content:space-between;align-items:center;">
        <span class="text-xs text-muted">中标/总计</span>
        <span class="mono font-semibold text-ink">${wonCount}/${totalCount}</span>
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

  // 计算风险维度
  const riskDimensions = calcRiskDimensions([], clearResults, 100);
  const avgRisk = Object.values(riskDimensions).reduce((a, b) => a + b, 0) / 5;
  const riskLevel = getRiskLevel(avgRisk);

  // 渲染风险雷达图
  const radarChart = renderRadarChart(riskDimensions, 350, 350);

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

      <!-- UIOLI风险雷达图 -->
      <div class="card mt-2" style="padding:12px;background:${riskLevel.level === 'high' ? '#fef2f2' : riskLevel.level === 'medium' ? '#fffbeb' : '#f0fdf4'};border:1px solid ${riskLevel.color};">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:16px;">⚠️</span>
          <span class="text-xs font-semibold uppercase" style="color:${riskLevel.color};">UIOLI风险评估</span>
        </div>
        <div style="display:flex;justify-content:center;margin-bottom:8px;">
          ${radarChart}
        </div>
        <div class="text-xs text-muted" style="line-height:1.7;">
          <strong>风险等级:</strong> <span style="color:${riskLevel.color};font-weight:600;">${riskLevel.label}</span><br/>
          <strong>综合得分:</strong> ${avgRisk.toFixed(1)}/100<br/>
          <strong>主要风险:</strong> ${getTopRisks(riskDimensions)}<br/>
          <strong>建议:</strong> ${getRiskAdvice(riskLevel.level)}
        </div>
      </div>

      <div class="text-xs text-muted mt-2">
        中标率: <span class="mono font-semibold">${(wonCount/totalCount*100).toFixed(1)}%</span><br/>
        平均中标价: <span class="mono">${clearResults.filter(r=>r.result.isUserWon).length > 0 ? (clearResults.filter(r=>r.result.isUserWon).reduce((s,r)=>s+r.result.mcpPrice,0)/clearResults.filter(r=>r.result.isUserWon).length).toFixed(1) : '--'}</span> 元/MWh
      </div>
    </div>`;
}

function getTopRisks(dimensions) {
  const sorted = Object.entries(dimensions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  const labels = {
    deviationRisk: '偏差风险',
    opportunityRisk: '机会损失',
    priceVolatility: '价格波动',
    winningRate: '中标率不足',
    capacityUtilization: '容量利用率低'
  };

  return sorted.map(([key, value]) => `${labels[key]}(${value.toFixed(0)})`).join('、');
}

function getRiskAdvice(level) {
  if (level === 'high') {
    return '建议提高报价以提升中标率，或调整合同规模以降低敞口风险';
  } else if (level === 'medium') {
    return '当前风险可控，但需关注中标率波动和价格走势';
  }
  return '风险较低，策略执行良好，可继续当前报价策略';
}

function renderBreakEvenAnalysis(analysis) {
  const summaryEl = document.getElementById('multi-summary');
  if (!summaryEl) return;

  const { scenarios, breakEvenPrice, recommendation } = analysis;

  // 生成盈亏曲线图
  const chartWidth = 350;
  const chartHeight = 200;
  const padL = 50, padR = 20, padT = 20, padB = 40;
  const cw = chartWidth - padL - padR;
  const ch = chartHeight - padT - padB;

  const maxProfit = Math.max(...scenarios.map(s => s.totalProfit));
  const minProfit = Math.min(...scenarios.map(s => s.totalProfit));
  const priceDomain = [scenarios[0].bidPrice, scenarios[scenarios.length - 1].bidPrice];

  function xPos(price) {
    return padL + ((price - priceDomain[0]) / (priceDomain[1] - priceDomain[0])) * cw;
  }

  function yPos(profit) {
    return padT + ch - ((profit - minProfit) / (maxProfit - minProfit)) * ch;
  }

  const linePath = scenarios.map((s, i) =>
    `${i === 0 ? 'M' : 'L'}${xPos(s.bidPrice)},${yPos(s.totalProfit)}`
  ).join(' ');

  // 零线（盈亏平衡线）
  const zeroY = yPos(0);

  const chartSVG = `
    <svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" style="background:#f8fafc;border-radius:8px;">
      <!-- 零线 -->
      <line x1="${padL}" y1="${zeroY}" x2="${padL + cw}" y2="${zeroY}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 2"/>
      <text x="${padL + cw + 4}" y="${zeroY + 4}" font-size="10" fill="#ef4444">盈亏平衡</text>

      <!-- 盈亏曲线 -->
      <path d="${linePath}" fill="none" stroke="#2563eb" stroke-width="3"/>

      <!-- 数据点 -->
      ${scenarios.map(s => {
        const color = s.totalProfit >= 0 ? '#10b981' : '#ef4444';
        return `<circle cx="${xPos(s.bidPrice)}" cy="${yPos(s.totalProfit)}" r="4" fill="${color}" stroke="white" stroke-width="2"/>`;
      }).join('')}

      <!-- 坐标轴 -->
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + ch}" stroke="#64748b" stroke-width="2"/>
      <line x1="${padL}" y1="${padT + ch}" x2="${padL + cw}" y2="${padT + ch}" stroke="#64748b" stroke-width="2"/>

      <!-- X轴标签 -->
      ${scenarios.map(s => `<text x="${xPos(s.bidPrice)}" y="${padT + ch + 20}" text-anchor="middle" font-size="10" fill="#64748b">${s.bidPrice}</text>`).join('')}

      <!-- Y轴标签 -->
      <text x="${padL - 8}" y="${yPos(maxProfit) + 4}" text-anchor="end" font-size="10" fill="#64748b">${(maxProfit/1000).toFixed(0)}k</text>
      <text x="${padL - 8}" y="${yPos(minProfit) + 4}" text-anchor="end" font-size="10" fill="#64748b">${(minProfit/1000).toFixed(0)}k</text>

      <!-- 标题 -->
      <text x="${chartWidth/2}" y="${chartHeight - 5}" text-anchor="middle" font-size="11" fill="#475569">报价 (元/MWh)</text>
      <text x="20" y="${chartHeight/2}" text-anchor="middle" font-size="11" fill="#475569" transform="rotate(-90, 20, ${chartHeight/2})">月度总盈亏 (元)</text>
    </svg>
  `;

  summaryEl.innerHTML = `
    <div class="flex flex-col gap-2 animate-fade">
      <div class="card" style="background:#eff6ff;border:1px solid #bfdbfe;padding:12px;">
        <div class="text-xs font-semibold text-primary uppercase mb-2">📅 月度盈亏平衡分析</div>
        <div>${chartSVG}</div>
      </div>

      <div class="kpi-card" style="background:#f0fdf4;border:1px solid #bbf7d0;">
        <div class="kpi-label">盈亏平衡报价</div>
        <div class="kpi-value text-success">${breakEvenPrice}<span class="kpi-unit">元/MWh</span></div>
      </div>

      <div class="card">
        <div class="text-xs font-semibold text-muted uppercase mb-1">策略建议</div>
        <div class="text-xs text-body" style="line-height:1.7;">
          ${recommendation}
        </div>
      </div>

      <div class="card">
        <div class="text-xs font-semibold text-muted uppercase mb-1">敏感性分析</div>
        <table class="data-table" style="font-size:11px;">
          <thead><tr>
            <th>报价</th><th>月度盈亏</th><th>盈利天数</th><th>盈利率</th>
          </tr></thead>
          <tbody>
            ${scenarios.map(s => `
              <tr style="${s.bidPrice === breakEvenPrice ? 'background:#f0fdf4;' : ''}">
                <td class="mono">${s.bidPrice}</td>
                <td class="mono ${s.totalProfit >= 0 ? 'text-success' : 'text-error'}">
                  ${s.totalProfit >= 0 ? '+' : ''}${(s.totalProfit/1000).toFixed(0)}k
                </td>
                <td>${s.profitableDays}/31</td>
                <td>${s.profitRate.toFixed(0)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="text-xs text-muted" style="line-height:1.7;">
        <strong>说明：</strong><br/>
        • 假设条件：容量100MW，全天中标<br/>
        • 工作日负荷系数1.0，周末负荷系数0.75<br/>
        • 盈亏平衡点：月度总盈亏≥0的最低报价
      </div>
    </div>
  `;
}

function renderChart() {
  const container = document.getElementById('multi-chart-container');
  if (!container) return;
  const w = container.clientWidth - 40; // 左右留边距
  const h = container.clientHeight - 20; // 上下留边距
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
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="margin:10px 20px;">
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
