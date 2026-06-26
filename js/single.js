// ============================================================
// 云霄直流PTR沙盘系统 — 单时段出清模块（三栏布局）
// ============================================================
import { SCENARIOS, P_FJ_CONTRACT, C_LOSS, BID_MIN, BID_MAX, generateAIBids } from './data.js';
import { runMCPClearing, calcSettlement, calcATC, detectFlowDirection, detectPhysicalBlocking } from './engine.js';
import { initCompactTopology, updateTopology, renderDispatchResult } from './topology.js';
import { aiEngine, generateAIBidsWithAdaptive } from './ai-strategy.js';

let currentScenario = 'flat';
let currentHour = 12;
let lastResult = null;
let flowDirectionChanged = false;

export function initSingle(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = buildHTML();
  initCompactTopology('single-topo-svg');
  bindEvents();
  updateSceneInfo();
}

function buildHTML() {
  return `
    <div class="three-col-layout">
      <!-- 左栏：输电权申报 -->
      <div class="flex flex-col gap-3">
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>输电权申报</h2>
          </div>
          <div class="panel-body">
            <div class="form-row">
              <label>时段</label>
              <select id="single-hour" class="input" style="width:80px;">
                ${Array.from({length:24}, (_,i) => `<option value="${i}">${String(i).padStart(2,'0')}:00</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <label>申报价</label>
              <input type="number" id="single-bid" class="input" value="65" min="${BID_MIN}" max="${BID_MAX}" step="0.1" style="width:100px;"/>
              <span class="text-xs text-muted">元/MWh</span>
            </div>
            <div class="form-row">
              <label>容量</label>
              <input type="number" id="single-qty" class="input" value="100" min="1" max="500" style="width:100px;"/>
              <span class="text-xs text-muted">MW</span>
            </div>
            <div class="flex gap-2 mt-2">
              <button id="single-submit" class="btn btn-primary btn-sm w-full">一键出清</button>
            </div>
            <div class="text-xs text-muted mt-2" style="line-height:1.6;">
              限价区间：<span class="mono">${BID_MIN} ~ ${BID_MAX}</span> 元/MWh<br/>
              福清核电合同价：<span class="mono">${P_FJ_CONTRACT}</span> 元/MWh<br/>
              网损代偿：<span class="mono">${C_LOSS}</span> 元/MWh
            </div>
          </div>
        </div>

        <!-- 结算账单 -->
        <div class="panel" style="flex:1;">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>结算账单</h2>
            <span id="single-result-badge" class="badge" style="display:none;"></span>
          </div>
          <div class="panel-body" id="single-result">
            <div class="text-center text-muted" style="padding:40px 0;">
              <div style="font-size:24px;margin-bottom:8px;">📊</div>
              <div class="text-sm">提交报价后查看出清结果</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 中栏：场景参数 + 拓扑图 + 排队图 -->
      <div class="flex flex-col gap-3">
        <!-- 场景参数 -->
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>场景参数</h2>
            <span id="single-scenario-badge" class="badge badge-primary">平枯普通</span>
          </div>
          <div class="panel-body">
            <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;" id="single-scene-info"></div>
          </div>
        </div>

        <!-- 拓扑图 + 调度结果 -->
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>物理拓扑 · 调度联动</h2>
            <span id="single-topo-badge" class="badge badge-success">正常</span>
          </div>
          <div class="panel-body" style="padding:4px;">
            <div id="single-topo-svg"></div>
            <div id="single-dispatch" class="mt-2" style="padding:0 4px;">
              <div class="text-xs text-muted">出清后显示调度结果</div>
            </div>
          </div>
        </div>

        <!-- 竞价排队图 -->
        <div class="panel" style="flex:1;min-height:260px;">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>竞价排队图</h2>
            <span id="single-mcp-badge" class="badge badge-warning">等待出清</span>
          </div>
          <div class="panel-body" style="padding:8px;">
            <div id="single-queue-chart" style="width:100%;height:240px;"></div>
          </div>
        </div>
      </div>

      <!-- 右栏：（预留，此处放AI对手信息 + 持仓信息） -->
      <div class="flex flex-col gap-3">
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>AI竞争对手</h2>
          </div>
          <div class="panel-body" id="single-ai-list">
            ${renderAIBiddersList()}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>中长期持仓</h2>
          </div>
          <div class="panel-body">
            <div class="kpi-card mb-2"><div class="kpi-label">合同电量</div><div class="kpi-value">100<span class="kpi-unit">MW</span></div></div>
            <div class="kpi-card mb-2"><div class="kpi-label">合同价格</div><div class="kpi-value">${P_FJ_CONTRACT}<span class="kpi-unit">元/MWh</span></div></div>
            <div class="kpi-card"><div class="kpi-label">绑定电源</div><div class="kpi-value text-sm" style="font-size:13px;">福清核电</div></div>
          </div>
        </div>
        <div class="panel" style="flex:1;">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>报价策略提示</h2>
          </div>
          <div class="panel-body" id="single-hint" style="font-size:12px;line-height:1.7;">
            <div class="text-muted">选择时段并输入报价后，系统将根据当前场景价差给出策略建议。</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderAIBiddersList() {
  const bidders = [
    { name: '华能广东交易部', type: '激进型', range: '90~100', color: 'var(--error)' },
    { name: '粤电大用户一', type: '理性型', range: '70~80', color: 'var(--primary)' },
    { name: '广汽售电中心', type: '理性型', range: '60~75', color: 'var(--primary)' },
    { name: '深能大用户二', type: '保守型', range: '40~50', color: 'var(--success)' },
    { name: '珠海售电公司', type: '极保守', range: '25.6~35', color: 'var(--muted)' },
  ];
  return bidders.map(b => `
    <div class="card" style="padding:6px 8px;">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-ink">${b.name}</span>
        <span class="badge badge-primary" style="font-size:9px;">${b.type}</span>
      </div>
      <div class="text-xs text-muted mt-1">报价区间: <span class="mono">${b.range}</span> 元/MWh</div>
    </div>
  `).join('');
}

function updateAILearningStatus() {
  const container = document.getElementById('single-ai-list');
  if (!container) return;

  const status = aiEngine.getStatusSummary();
  const baseBidders = renderAIBiddersList();

  if (status.active) {
    const learningCard = `
      <div class="card" style="background:#fef3c7;border:1px solid #fbbf24;padding:8px;margin-bottom:8px;">
        <div class="flex items-center gap-2 mb-1">
          <span style="font-size:16px;">🧠</span>
          <span class="text-xs font-semibold text-warning">AI学习状态激活</span>
        </div>
        <div class="text-xs text-body" style="line-height:1.7;">
          ${status.message}<br/>
          <strong>平均报价:</strong> ${status.details.avgBid} 元/MWh<br/>
          <strong>平均利用率:</strong> ${status.details.avgUtilization}<br/>
          <span class="text-warning font-semibold">⚠️ 华能广东交易部已切换为"贴身报价"模式</span>
        </div>
      </div>`;
    container.innerHTML = learningCard + baseBidders;
  } else {
    container.innerHTML = baseBidders;
  }
}

function bindEvents() {
  document.getElementById('single-hour')?.addEventListener('change', e => {
    currentHour = parseInt(e.target.value);
    updateSceneInfo();
    updateHint();
  });
  document.getElementById('single-submit')?.addEventListener('click', runClearing);
  document.getElementById('single-bid')?.addEventListener('input', updateHint);
}

export function setSingleScenario(s) {
  currentScenario = s;
  updateSceneInfo();
  lastResult = null;
  const badge = document.getElementById('single-result-badge');
  if (badge) badge.style.display = 'none';
  const resultEl = document.getElementById('single-result');
  if (resultEl) resultEl.innerHTML = `<div class="text-center text-muted" style="padding:40px 0;"><div style="font-size:24px;margin-bottom:8px;">📊</div><div class="text-sm">提交报价后查看出清结果</div></div>`;
  const mcpBadge = document.getElementById('single-mcp-badge');
  if (mcpBadge) { mcpBadge.textContent = '等待出清'; mcpBadge.className = 'badge badge-warning'; }
  const topoBadge = document.getElementById('single-topo-badge');
  if (topoBadge) { topoBadge.textContent = '正常'; topoBadge.className = 'badge badge-success'; }
  renderQueueChart(null);
  renderDispatchResult('single-dispatch', null);
  updateTopology(s, false, null);
  updateHint();
}

function updateSceneInfo() {
  const s = SCENARIOS[currentScenario];
  const atcInfo = calcATC(currentScenario, currentHour);
  const flowInfo = detectFlowDirection(currentScenario, currentHour);

  const badge = document.getElementById('single-scenario-badge');
  if (badge) badge.textContent = s.name;

  const info = document.getElementById('single-scene-info');
  if (info) {
    // 检测潮流方向是否改变
    const prevDirection = lastResult?.flowDirection || 'forward';
    if (flowInfo.direction !== prevDirection) {
      flowDirectionChanged = true;
      showFlowDirectionAlert(flowInfo);
    }

    info.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">福建现货价</div><div class="kpi-value">${s.fj_spot[currentHour]}<span class="kpi-unit">元/MWh</span></div></div>
      <div class="kpi-card"><div class="kpi-label">广东现货价</div><div class="kpi-value">${s.gd_spot[currentHour]}<span class="kpi-unit">元/MWh</span></div></div>
      <div class="kpi-card"><div class="kpi-label">可用通道</div><div class="kpi-value">${atcInfo.atc}<span class="kpi-unit">MW</span></div></div>
      <div class="kpi-card"><div class="kpi-label">风电出力</div><div class="kpi-value">${atcInfo.windOutput}<span class="kpi-unit">MW</span></div></div>
      <div class="kpi-card"><div class="kpi-label">潮流方向</div><div class="kpi-value" style="font-size:12px;">${flowInfo.direction === 'reverse' ? '⬅️粤→闽' : '➡️闽→粤'}</div></div>`;
  }

  const hourSel = document.getElementById('single-hour');
  if (hourSel) hourSel.value = currentHour;

  // 检测物理阻塞
  const constraints = detectPhysicalBlocking(currentScenario, currentHour, atcInfo.windOutput);
  if (constraints.length > 0) {
    showPhysicalBlockingWarning(constraints);
  }
}

function showFlowDirectionAlert(flowInfo) {
  if (flowInfo.trigger === 'price_inversion') {
    showModal('潮流方向自动切换',
      `<div class="text-sm" style="line-height:1.8;">
        当前两省现货价差发生逆转：<br/>
        <strong>广东现货价 ${flowInfo.gdPrice}元 &lt; 福建现货价 ${flowInfo.fjPrice}元</strong><br/><br/>
        通道潮流已自动切换为 <strong class="text-warning">反向送电模式（粤→闽）</strong>。<br/>
        受控容量已根据稳控装置约束动态调整。
      </div>`,
      'info');
  }
}

function showPhysicalBlockingWarning(constraints) {
  const details = constraints.map(c => `
    <div class="card mb-2" style="background:${c.severity === 'high' ? '#fef2f2' : '#fffbeb'};border:1px solid ${c.severity === 'high' ? '#fecaca' : '#fed7aa'};">
      <div class="text-xs font-semibold" style="color:${c.severity === 'high' ? 'var(--error)' : 'var(--warning)'};">${c.icon} ${c.reason}</div>
      <div class="text-xs text-muted mt-1">${c.detail}</div>
      <div class="text-xs mono mt-1" style="color:${c.severity === 'high' ? 'var(--error)' : 'var(--warning)'};">容量缩减: -${c.reduction}MW</div>
    </div>
  `).join('');

  showModal('物理阻塞警告',
    `<div class="text-sm mb-2">检测到以下物理约束导致通道容量缩减：</div>${details}`,
    'warning');
}

function updateHint() {
  const el = document.getElementById('single-hint');
  if (!el) return;
  const s = SCENARIOS[currentScenario];
  const gdSpot = s.gd_spot[currentHour];
  const spread = gdSpot - P_FJ_CONTRACT - C_LOSS;
  const bidInput = document.getElementById('single-bid');
  const bid = parseFloat(bidInput?.value) || 0;
  const rationalBid = Math.max(BID_MIN, Math.min(BID_MAX, Math.round((spread - 15) * 10) / 10));

  let hint = '';
  if (spread <= 0) {
    hint = `<div class="card" style="background:var(--error-light);border:1px solid #fecaca;"><div class="text-xs text-error font-semibold">价差为负 (${spread.toFixed(0)}元)，无套利空间</div><div class="text-xs text-muted mt-1">广东现货价低于福建到货成本，不建议竞标通道。</div></div>`;
  } else {
    hint = `<div class="card"><div class="text-xs text-muted">当前价差</div><div class="mono font-semibold text-ink">${spread.toFixed(0)} 元/MWh</div></div>`;
    hint += `<div class="card"><div class="text-xs text-muted">理性报价参考</div><div class="mono font-semibold text-primary">${rationalBid} 元/MWh</div></div>`;
    if (bid > 0) {
      const profit = (spread - bid) * 100;
      hint += `<div class="card"><div class="text-xs text-muted">预估利润 (100MW)</div><div class="mono font-semibold ${profit >= 0 ? 'text-success' : 'text-error'}">${profit >= 0 ? '+' : ''}${profit.toFixed(0)} 元</div></div>`;
    }
  }
  el.innerHTML = hint;
}

function runClearing() {
  const bidInput = document.getElementById('single-bid');
  const qtyInput = document.getElementById('single-qty');
  const bid = parseFloat(bidInput.value);
  const qty = parseFloat(qtyInput.value);

  if (isNaN(bid) || bid < BID_MIN || bid > BID_MAX) {
    showModal('报价超出限价范围', `根据734号文第五条规定，申报价格必须在 <strong>${BID_MIN} ~ ${BID_MAX} 元/MWh</strong> 之间。您输入的价格为 <strong>${bid}</strong> 元/MWh，不符合规定。`, 'error');
    bidInput.classList.add('input-error');
    setTimeout(() => bidInput.classList.remove('input-error'), 2000);
    return;
  }
  if (isNaN(qty) || qty <= 0) {
    showModal('容量输入错误', '申报容量必须大于 0 MW。', 'error');
    return;
  }

  const atcInfo = calcATC(currentScenario, currentHour);
  const flowInfo = detectFlowDirection(currentScenario, currentHour);

  // 使用自适应AI报价生成
  const aiBids = generateAIBidsWithAdaptive(currentScenario, currentHour, generateAIBids);

  const result = runMCPClearing(bid, qty, atcInfo.atc, aiBids);
  const settlement = calcSettlement(result, currentScenario, currentHour);

  // 记录到AI学习引擎
  aiEngine.recordBid(bid, result.isUserWon, result.userWinQty, atcInfo.atc, result.mcpPrice);

  // 保存流向信息
  result.flowDirection = flowInfo.direction;
  result.windOutput = atcInfo.windOutput;
  result.hour = currentHour;

  lastResult = { result, settlement };

  // 更新拓扑联动
  updateTopology(currentScenario, result.isUserWon, result);

  // 更新拓扑badge
  const topoBadge = document.getElementById('single-topo-badge');
  if (topoBadge) {
    topoBadge.textContent = result.isUserWon ? '电流贯通' : '通道中断';
    topoBadge.className = result.isUserWon ? 'badge badge-success' : 'badge badge-error';
  }

  // 更新MCP标签
  const mcpBadge = document.getElementById('single-mcp-badge');
  if (mcpBadge) {
    mcpBadge.textContent = `出清价: ${result.mcpPrice}元`;
    mcpBadge.className = 'badge badge-success';
  }

  // 渲染调度结果
  renderDispatchResult('single-dispatch', result);

  // 渲染排队图
  renderQueueChart(result);

  // 渲染结算账单
  renderSettlement(result, settlement);

  // 更新AI学习状态显示
  updateAILearningStatus();

  // 更新提示
  updateHint();
}

function renderQueueChart(result) {
  const container = document.getElementById('single-queue-chart');
  if (!container) return;
  if (!result) {
    container.innerHTML = '<div class="text-center text-muted" style="padding:40px 0;font-size:12px;">出清后显示排队图</div>';
    return;
  }

  const queue = result.fullQueue;
  const atc = result.atc;
  const chartW = container.clientWidth;
  const chartH = 100; // 进一步降低高度
  const padL = 80, padR = 20, padT = 5, padB = 15;
  const barH = 14; // 横向柱子高度
  const barGap = 3;
  const maxQty = Math.max(...queue.map(b => b.qty));
  const plotW = chartW - padL - padR;

  const bars = queue.map((b, i) => {
    const y = padT + i * (barH + barGap);
    const w = (b.qty / maxQty) * plotW;
    let cls = 'lost-bar';
    if (b.isUser) cls = b.status === 'Won' ? 'user-bar' : b.status === 'Marginal' ? 'marginal-bar' : 'user-bar';
    else cls = b.status === 'Won' ? 'won-bar' : b.status === 'Marginal' ? 'marginal-bar' : 'lost-bar';
    const name = b.isUser ? '您' : b.name;
    const fill = cls === 'user-bar' ? '#2563eb' : cls === 'won-bar' ? '#10b981' : cls === 'marginal-bar' ? '#f59e0b' : '#cbd5e1';

    return `
      <rect x="${padL}" y="${y}" width="${w}" height="${barH}" rx="3" fill="${fill}" opacity="0.85"/>
      <text x="${padL - 6}" y="${y + barH/2 + 4}" text-anchor="end" font-size="10" font-weight="600" fill="#1e293b">${name}</text>
      <text x="${padL + w + 6}" y="${y + barH/2 + 4}" font-size="10" font-weight="600" fill="${fill}" font-family="var(--mono)">${b.price}元</text>
    `;
  }).join('');

  // ATC标线
  let cumulativeQty = 0;
  let atcLineX = padL;
  for (const b of queue) {
    if (cumulativeQty >= atc) break;
    cumulativeQty += b.qty;
    atcLineX = padL + (cumulativeQty / maxQty) * plotW;
  }

  container.innerHTML = `
    <svg width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" style="background:#f8fafc;border-radius:8px;">
      ${bars}
      <line x1="${atcLineX}" y1="${padT}" x2="${atcLineX}" y2="${padT + queue.length * (barH + barGap)}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 2"/>
      <text x="${atcLineX}" y="${padT + queue.length * (barH + barGap) + 14}" text-anchor="middle" font-size="9" font-weight="600" fill="#ef4444">ATC</text>
    </svg>`;
}

function renderSettlement(result, settlement) {
  const resultEl = document.getElementById('single-result');
  const badge = document.getElementById('single-result-badge');
  if (!resultEl) return;

  if (badge) {
    badge.style.display = 'inline-flex';
    if (settlement.outcome === 'won') {
      badge.className = 'badge badge-success';
      badge.textContent = '中标';
    } else {
      badge.className = 'badge badge-error';
      badge.textContent = '未中标';
    }
  }

  const s = SCENARIOS[currentScenario];
  const gdSpot = s.gd_spot[currentHour];

  if (settlement.outcome === 'won') {
    // 出清分析
    const deltaPrice = result.fullQueue.find(b=>b.isUser).price - result.mcpPrice;
    const clearingAnalysis = `
      <div class="card mt-2">
        <div class="text-xs font-semibold text-muted uppercase mb-2">📊 出清分析</div>
        <div class="text-xs" style="line-height:1.8;">
          您的报价: <span class="mono font-semibold">${result.fullQueue.find(b=>b.isUser).price}</span> 元/MWh<br/>
          边际出清价: <span class="mono font-semibold text-warning">${result.mcpPrice}</span> 元/MWh<br/>
          价差 (Delta): <span class="mono font-semibold ${deltaPrice >= 0 ? 'text-success' : 'text-error'}">
            ${deltaPrice >= 0 ? '+' : ''}${deltaPrice.toFixed(1)}
          </span> 元/MWh<br/>
          ${deltaPrice > 0
            ? `⚠️ 超额支付 ${deltaPrice.toFixed(1)} 元`
            : `✅ 最优报价（恰好中标）`
          }
        </div>
      </div>`;

    resultEl.innerHTML = `
      <div class="flex flex-col gap-2 animate-fade">
        <div class="kpi-card"><div class="kpi-label">到货电量</div><div class="kpi-value">${settlement.winQty}<span class="kpi-unit">MWh</span></div></div>
        <div class="kpi-card"><div class="kpi-label">跨省综合总成本</div><div class="kpi-value">${settlement.totalCost.toFixed(0)}<span class="kpi-unit">元</span></div></div>
        <div class="kpi-card"><div class="kpi-label">现货交割收益</div><div class="kpi-value">${settlement.spotRevenue.toFixed(0)}<span class="kpi-unit">元</span></div></div>
        <div class="kpi-card"><div class="kpi-label">时段净损益</div><div class="kpi-value ${settlement.netProfit >= 0 ? 'positive' : 'negative'}">${settlement.netProfit >= 0 ? '+' : ''}${settlement.netProfit.toFixed(0)}<span class="kpi-unit">元</span></div></div>
        <div class="card" style="margin-top:4px;">
          <div class="text-xs font-semibold text-muted uppercase mb-2">成本明细</div>
          <table class="data-table">
            <tr><td>电能量成本</td><td class="text-right">${P_FJ_CONTRACT} × ${settlement.winQty}</td><td class="text-right mono">${settlement.energyCost.toFixed(0)}元</td></tr>
            <tr><td>通道费 (PTR)</td><td class="text-right">${result.mcpPrice} × ${settlement.winQty}</td><td class="text-right mono">${settlement.ptrCost.toFixed(0)}元</td></tr>
            <tr><td>网损代偿</td><td class="text-right">${C_LOSS} × ${settlement.winQty}</td><td class="text-right mono">${settlement.lossCost.toFixed(0)}元</td></tr>
            <tr style="font-weight:600;"><td>广东现货结算</td><td class="text-right">${gdSpot} × ${settlement.winQty}</td><td class="text-right mono text-success">+${settlement.spotRevenue.toFixed(0)}元</td></tr>
          </table>
        </div>
        ${clearingAnalysis}
        <div class="text-xs text-muted">
          省间价差利润空间: <span class="mono font-semibold text-ink">${settlement.spread.toFixed(1)}</span> 元/MWh
        </div>
      </div>`;
  } else {
    // 未中标 - 添加机会成本分析
    resultEl.innerHTML = `
      <div class="flex flex-col gap-2 animate-fade">
        <div class="kpi-card" style="background:var(--error-light);border:1px solid #fecaca;">
          <div class="kpi-label" style="color:var(--error);">未中标 — 跨省套利中断</div>
          <div class="kpi-value negative">0<span class="kpi-unit">MWh 到货</span></div>
        </div>
        <div class="kpi-card"><div class="kpi-label">偏差扣罚</div><div class="kpi-value negative">-${settlement.penaltyCost.toFixed(0)}<span class="kpi-unit">元</span></div></div>
        <div class="kpi-card" style="background:#fef2f2;border:1px solid #fecaca;">
          <div class="kpi-label">机会成本损失</div>
          <div class="kpi-value negative">-${settlement.opportunityCostLoss.toFixed(0)}<span class="kpi-unit">元</span></div>
          <div class="text-xs text-muted mt-1">
            💡 若报价 ${settlement.minWinningBid} 元，可获利 ${settlement.potentialProfit.toFixed(0)} 元
          </div>
        </div>
        <div class="card" style="margin-top:4px;">
          <div class="text-xs font-semibold text-muted uppercase mb-2">未中标原因分析</div>
          <div class="text-xs" style="line-height:1.8;">
            您的报价 <span class="mono font-semibold">${result.fullQueue.find(b=>b.isUser)?.price}</span> 元/MWh 低于边际出清价 <span class="mono font-semibold text-warning">${result.mcpPrice}</span> 元/MWh。<br/>
            通道被出价更高的竞争者占据，中长期购电合同物理履约中断。<br/>
            广东终端负荷需以本地现货价 <span class="mono font-semibold">${gdSpot}</span> 元/MWh 采购替代电量。
          </div>
        </div>
        <div class="card" style="background:#fffbeb;border:1px solid #fed7aa;">
          <div class="text-xs font-semibold text-warning uppercase mb-2">📊 出清透明化分析</div>
          <div class="text-xs" style="line-height:1.8;">
            价差 (Delta): <span class="mono font-semibold text-error">${(result.fullQueue.find(b=>b.isUser)?.price - result.mcpPrice).toFixed(1)}</span> 元/MWh<br/>
            💡 若多报 <strong>${Math.abs(result.fullQueue.find(b=>b.isUser)?.price - result.mcpPrice).toFixed(1)}</strong> 元即可中标<br/>
            预期利润: <strong>+${settlement.potentialProfit.toFixed(0)}</strong> 元<br/>
            实际损失: <strong>-${settlement.opportunityCostLoss.toFixed(0)}</strong> 元
          </div>
        </div>
      </div>`;
  }
}

function showModal(title, body, type = 'info') {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const borderColor = type === 'error' ? 'var(--error)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)';
  overlay.innerHTML = `
    <div class="modal" style="border-top:3px solid ${borderColor};">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button class="btn btn-primary btn-sm" onclick="this.closest('.modal-overlay').remove()">确认</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
