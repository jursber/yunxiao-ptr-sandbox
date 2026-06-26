// ============================================================
// 云霄直流PTR沙盘系统 — SVG拓扑图模块
// ============================================================
import { NODES, EDGES, SCENARIOS, P_FJ_CONTRACT, C_LOSS, COST_TEMPLATES } from './data.js';
import { calcATC } from './engine.js';

let currentScenario = 'flat';
let isBlocked = false;
let wonNodes = new Set();
let lastClearingResult = null;

// --- 完整拓扑（Tab页静态展示） ---
export function initTopology(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  renderSVG(container, false);
}

// --- 紧凑拓扑（嵌入出清页面） ---
export function initCompactTopology(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  renderSVG(container, true);
}

function renderSVG(container, compact) {
  const vb = compact ? '0 45 920 340' : '0 0 920 400';
  const nodeR = compact ? 16 : 18;
  const convR = compact ? 18 : 22;
  const nameFontSize = compact ? 10 : 11;
  const subFontSize = compact ? 8 : 9;
  const tagFontSize = compact ? 9 : 10;

  function renderNodesCompact() {
    return NODES.map(n => {
      const isRef = n.type === 'load_equivalent' || n.type === 'grid_equivalent';
      const strokeDash = isRef ? 'stroke-dasharray="4 2"' : '';
      const isGen = n.type.startsWith('generator');
      const isWind = n.type === 'generator_wind';
      const isLoad = n.type === 'load_equivalent';
      const isConverter = n.type.startsWith('converter');
      const nodeClass = wonNodes.has(n.id) ? 'topo-node-circle won' : 'topo-node-circle';
      const r = isConverter ? convR : nodeR;

      let tags = '';
      if (!compact) {
        if (isGen && !isWind) {
          tags = `<rect x="${n.x - 33}" y="${n.y - r - 18}" width="66" height="18" rx="5" class="topo-tag topo-tag-gen"/>
            <text x="${n.x}" y="${n.y - r - 6}" text-anchor="middle" class="topo-tag-gen-text" font-size="${tagFontSize}" font-weight="600">发电 ${n.capacity_mw}MW</text>`;
        }
        if (isWind) {
          tags = `<rect x="${n.x - 35}" y="${n.y - r - 18}" width="70" height="18" rx="5" class="topo-tag topo-tag-wind"/>
            <text x="${n.x}" y="${n.y - r - 6}" text-anchor="middle" class="topo-tag-wind-text" font-size="${tagFontSize}" font-weight="600">🌬️ 风电 ${n.capacity_mw}MW</text>`;
        }
        if (isLoad) {
          tags = `<rect x="${n.x - 35}" y="${n.y - r - 18}" width="70" height="18" rx="5" class="topo-tag topo-tag-load"/>
            <text x="${n.x}" y="${n.y - r - 6}" text-anchor="middle" class="topo-tag-load-text" font-size="${tagFontSize}" font-weight="600">负荷节点</text>`;
        }
        if (isConverter) {
          const color = isBlocked ? '#ef4444' : '#eab308';
          tags = `<rect x="${n.x - 30}" y="${n.y + r + 4}" width="60" height="16" rx="5" fill="${color}22" stroke="${color}" stroke-width="1"/>
            <text x="${n.x}" y="${n.y + r + 15}" text-anchor="middle" fill="${color}" font-size="${tagFontSize}" font-weight="600">${n.type.includes('fujian') ? '送端' : '受端'}</text>`;
        }
      }

      // 节点数据标签（联动模式）
      let dataLabel = '';
      if (lastClearingResult && isGen && n.id === 'gen_fq') {
        const price = P_FJ_CONTRACT;
        dataLabel = `<text x="${n.x}" y="${n.y + r + 8}" text-anchor="middle" font-size="${subFontSize}" fill="#2563eb" font-family="var(--mono)">${price}元</text>`;
      }
      if (lastClearingResult && n.id === 'grid_gd') {
        const s = SCENARIOS[currentScenario];
        const gdPrice = lastClearingResult.hour !== undefined ? s.gd_spot[lastClearingResult.hour] : '--';
        dataLabel = `<text x="${n.x}" y="${n.y + r + 8}" text-anchor="middle" font-size="${subFontSize}" fill="#ef4444" font-family="var(--mono)">${gdPrice}元</text>`;
      }
      if (lastClearingResult && isWind && n.id === 'gen_pt') {
        const windOutput = lastClearingResult.windOutput || 0;
        dataLabel = `<text x="${n.x}" y="${n.y + r + 8}" text-anchor="middle" font-size="${subFontSize}" fill="#10b981" font-family="var(--mono)">${windOutput}MW</text>`;
      }

      // 节点点击事件（用于显示成本曲线）
      const clickHandler = n.cost_curve ? `onclick="window.showNodeCostCurve('${n.id}')"` : '';
      const cursorStyle = n.cost_curve ? 'cursor:pointer;' : '';

      return `<g class="topo-node" data-id="${n.id}" ${clickHandler} style="${cursorStyle}">
        <circle cx="${n.x}" cy="${n.y}" r="${r}" class="${nodeClass}" ${strokeDash}/>
        <text x="${n.x}" y="${n.y + 3}" class="topo-node-name" font-size="${nameFontSize}" text-anchor="middle">${n.name}</text>
        ${n.base_price && !compact ? `<text x="${n.x}" y="${n.y + r + 14}" class="topo-node-sub" font-size="${subFontSize}" text-anchor="middle">${n.base_price}元</text>` : ''}
        ${tags}
        ${dataLabel}
      </g>`;
    }).join('');
  }

  function renderEdgesCompact() {
    return EDGES.map(e => {
      const from = NODES.find(n => n.id === e.from);
      const to = NODES.find(n => n.id === e.to);
      if (!from || !to) return '';
      const isDC = e.isDC;
      let cls = isDC ? 'topo-edge dc-line flowing' : 'topo-edge';

      // 所有线路都添加箭头
      const marker = isDC
        ? `marker-end="url(#arrow${isBlocked ? 'Red' : 'Blue'}${compact ? '-c' : ''})"`
        : `marker-end="url(#arrowGray${compact ? '-c' : ''})"`;

      let labelHtml = '';
      if (e.label && !compact && !isDC) {
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2 - 8;
        labelHtml = `<text x="${mx}" y="${my}" class="topo-label" font-size="8">${e.label}</text>`;
      }
      // 联动：中标时DC连线变绿
      if (isDC && lastClearingResult && lastClearingResult.isUserWon) {
        cls = 'topo-edge dc-line flowing';
      }
      return `<line id="edge-${e.from}-${e.to}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${cls}" ${marker}/>${labelHtml}`;
    }).join('');
  }

  const atcInfo = calcATC(currentScenario);
  const atc = atcInfo.atc;
  const dcLabelY = compact ? 135 : 140;
  const dcMidX = compact ? 460 : 460;

  const svg = `<svg class="${compact ? 'topo-compact-svg' : 'topo-svg'}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid${compact ? '-c' : ''}" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.5" fill="#e2e8f0"/>
      </pattern>
      <marker id="arrowBlue${compact ? '-c' : ''}" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
        <polygon points="0,0 10,4 0,8" fill="#388bfd" opacity="0.7">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
        </polygon>
      </marker>
      <marker id="arrowRed${compact ? '-c' : ''}" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
        <polygon points="0,0 10,4 0,8" fill="#ef4444" opacity="0.7">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
        </polygon>
      </marker>
      <marker id="arrowGray${compact ? '-c' : ''}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0,0 8,3 0,6" fill="#94a3b8" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.3;0.6" dur="1.5s" repeatCount="indefinite"/>
        </polygon>
      </marker>
    </defs>
    <rect x="${compact ? '0' : '0'}" y="${compact ? '45' : '0'}" width="920" height="${compact ? '340' : '400'}" fill="url(#grid${compact ? '-c' : ''})"/>

    ${!compact ? `
    <text x="180" y="30" class="topo-label" font-size="11" font-weight="600" fill="#64748b" letter-spacing="0.08em">华东 / 福建电网</text>
    <text x="720" y="30" class="topo-label" font-size="11" font-weight="600" fill="#64748b" letter-spacing="0.08em">南方 / 广东电网</text>
    ` : ''}

    ${renderEdgesCompact()}
    ${renderNodesCompact()}

    <!-- DC线路标签：闽粤联网直流 -->
    <text x="${dcMidX}" y="195" text-anchor="middle" font-size="11" font-weight="700" fill="#1e293b">闽粤联网直流</text>

    <!-- ATC状态标签：移到线路上方 -->
    <g id="dc-label${compact ? '-c' : ''}" transform="translate(${dcMidX}, ${dcLabelY})">
      <rect x="-45" y="-18" width="90" height="36" rx="6" fill="rgba(255,255,255,0.95)" stroke="#d1d5db" stroke-width="1"/>
      <text x="0" y="-3" text-anchor="middle" font-size="10" font-weight="600" fill="#1e293b" font-family="var(--mono)" id="dc-capacity${compact ? '-c' : ''}">ATC: ${atc}MW</text>
      <text x="0" y="10" text-anchor="middle" font-size="8" fill="#10b981" id="dc-status${compact ? '-c' : ''}">状态: 正常</text>
    </g>
  </svg>`;
  container.innerHTML = svg;
}

// --- 更新拓扑（场景切换 + 出清联动） ---
export function updateTopology(scenario, isUserWon, clearingResult) {
  currentScenario = scenario;
  const s = SCENARIOS[scenario];
  const hour = clearingResult?.hour || 12;
  const atcInfo = calcATC(scenario, hour);
  const atc = atcInfo.atc;
  isBlocked = scenario === 'hot' || s.flow_direction === 'reverse';
  if (clearingResult) lastClearingResult = clearingResult;

  // 更新DC通道状态（两种模式）
  ['dc-line'].forEach(cls => {
    document.querySelectorAll(`.${cls}`).forEach(dcLine => {
      dcLine.classList.toggle('blocked', isBlocked);
      dcLine.classList.toggle('flowing', !isBlocked);
      const marker = isBlocked ? 'url(#arrowRed)' : 'url(#arrowBlue)';
      dcLine.setAttribute('marker-end', marker);
      // compact模式用不同的marker id
      if (dcLine.closest('.topo-compact-svg')) {
        dcLine.setAttribute('marker-end', isBlocked ? 'url(#arrowRed-c)' : 'url(#arrowBlue-c)');
      }

      // 拥挤感视觉反馈
      if (clearingResult) {
        const utilizationRate = (clearingResult.userWinQty / atc) * 100;
        if (utilizationRate > 95) {
          dcLine.classList.add('congested');
          dcLine.style.animationDuration = '8s';
          dcLine.style.animationTimingFunction = 'steps(5)';
        } else {
          dcLine.classList.remove('congested');
          dcLine.style.animationDuration = '2s';
          dcLine.style.animationTimingFunction = 'ease-in-out';
        }
      }
    });
  });

  // 更新ATC标签
  ['dc-capacity', 'dc-capacity-c'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `ATC: ${atc}MW`;
  });
  ['dc-status', 'dc-status-c'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (lastClearingResult) {
        el.textContent = lastClearingResult.isUserWon ? '中标' : '中断';
        el.setAttribute('fill', lastClearingResult.isUserWon ? '#10b981' : '#ef4444');
      } else {
        el.textContent = isBlocked ? '状态: 阻塞' : '状态: 正常';
        el.setAttribute('fill', isBlocked ? '#ef4444' : '#10b981');
      }
    }
  });

  // 更新节点中标状态
  wonNodes.clear();
  if (isUserWon) {
    wonNodes.add('gen_fq');
  }
  document.querySelectorAll('.topo-node').forEach(g => {
    const id = g.dataset.id;
    const circle = g.querySelector('circle');
    if (circle) {
      circle.classList.toggle('won', wonNodes.has(id));
      circle.classList.toggle('lost', !wonNodes.has(id) && id !== 'cv_yx' && id !== 'cv_ec');
    }
  });

  // 更新右侧ATC状态面板（Tab拓扑页）
  const atcCard = document.querySelector('#topo-status .card');
  if (atcCard) {
    const color = isBlocked ? 'var(--error-light)' : 'var(--success-light)';
    const border = isBlocked ? '#fecaca' : 'var(--success-border)';
    const textColor = isBlocked ? 'var(--error)' : 'var(--success)';
    atcCard.style.background = color;
    atcCard.style.borderColor = border;
    const label = atcCard.querySelector('.text-xs');
    if (label) label.style.color = textColor;
    const val = atcCard.querySelector('.kpi-value');
    if (val) {
      val.style.color = textColor;
      val.innerHTML = `${atc}<span class="kpi-unit">MW</span>`;
    }
  }
  const gcEl = document.getElementById('topo-grid-constraint');
  if (gcEl) {
    gcEl.innerHTML = `${s.grid_constraint}<span class="kpi-unit">MW</span>`;
    gcEl.style.color = isBlocked ? 'var(--error)' : 'var(--ink)';
  }
}

// --- 渲染调度结果面板 ---
export function renderDispatchResult(containerId, clearingResult) {
  const el = document.getElementById(containerId);
  if (!el || !clearingResult) {
    if (el) el.innerHTML = '<div class="text-xs text-muted">出清后显示调度结果</div>';
    return;
  }

  const queue = clearingResult.fullQueue;
  const items = queue.slice(0, 6).map(b => {
    const dotCls = b.status === 'Won' ? 'won' : b.status === 'Marginal' ? 'marginal' : 'lost';
    const statusText = b.status === 'Won' ? '✓' : b.status === 'Marginal' ? '◐' : '✗';
    const name = b.isUser ? '您' : b.name;
    return `<div class="dispatch-item-compact">
      <span class="dispatch-dot ${dotCls}"></span>
      <span class="dispatch-name" style="font-size:10px;">${name}</span>
      <span class="dispatch-price" style="font-size:10px;">${b.price}</span>
      <span class="text-xs" style="color:${dotCls === 'won' ? 'var(--success)' : dotCls === 'marginal' ? 'var(--warning)' : 'var(--dim)'};">${statusText}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="text-xs font-semibold text-muted uppercase mb-1">调度出清结果</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">${items}</div>
    <div class="text-xs text-muted mt-1" style="border-top:1px solid var(--divider2);padding-top:4px;">
      边际出清价: <span class="mono font-semibold text-warning">${clearingResult.mcpPrice}</span> 元/MWh ·
      ATC: <span class="mono">${clearingResult.atc}</span> MW
    </div>`;
}

export function resetTopology() {
  wonNodes.clear();
  isBlocked = false;
  lastClearingResult = null;
}

// --- 显示节点成本曲线模态框 ---
window.showNodeCostCurve = function(nodeId) {
  const node = NODES.find(n => n.id === nodeId);
  if (!node || !node.cost_curve) return;

  const template = COST_TEMPLATES[node.cost_curve];
  if (!template) return;

  // 渲染成本曲线图
  const maxP = node.capacity_mw;
  const points = [];
  for (let p = 0; p <= maxP; p += maxP / 50) {
    const cost = template.marginalCost(p);
    points.push({ p, cost });
  }

  const w = 500;
  const h = 300;
  const padL = 60, padR = 20, padT = 30, padB = 40;
  const cw = w - padL - padR;
  const ch = h - padT - padB;

  const maxCost = Math.max(...points.map(pt => pt.cost));
  const minCost = Math.min(...points.map(pt => pt.cost));

  function xPos(p) { return padL + (p / maxP) * cw; }
  function yPos(cost) { return padT + ch - ((cost - minCost) / (maxCost - minCost)) * ch; }

  const linePath = points.map((pt, i) =>
    `${i === 0 ? 'M' : 'L'}${xPos(pt.p)},${yPos(pt.cost)}`
  ).join(' ');

  // 当前出力点（假设基荷运行）
  const currentP = node.capacity_mw * 0.8;
  const currentCost = template.marginalCost(currentP);

  const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="background:#f8fafc;border-radius:8px;">
      <!-- 网格线 -->
      ${Array.from({length: 5}, (_, i) => {
        const cost = minCost + (maxCost - minCost) * (i / 4);
        const y = yPos(cost);
        return `<line x1="${padL}" y1="${y}" x2="${padL + cw}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>
                <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#94a3b8">${Math.round(cost)}</text>`;
      }).join('')}

      <!-- 坐标轴 -->
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + ch}" stroke="#64748b" stroke-width="2"/>
      <line x1="${padL}" y1="${padT + ch}" x2="${padL + cw}" y2="${padT + ch}" stroke="#64748b" stroke-width="2"/>

      <!-- 成本曲线 -->
      <path d="${linePath}" fill="none" stroke="#3b82f6" stroke-width="3"/>

      <!-- 当前出力点 -->
      <circle cx="${xPos(currentP)}" cy="${yPos(currentCost)}" r="6" fill="#ef4444" stroke="white" stroke-width="2"/>
      <line x1="${xPos(currentP)}" y1="${yPos(currentCost)}" x2="${xPos(currentP)}" y2="${padT + ch}" stroke="#ef4444" stroke-width="1" stroke-dasharray="4 2"/>

      <!-- 标签 -->
      <text x="${w/2}" y="${h - 10}" text-anchor="middle" font-size="12" fill="#475569">出力 (MW)</text>
      <text x="20" y="${h/2}" text-anchor="middle" font-size="12" fill="#475569" transform="rotate(-90, 20, ${h/2})">边际成本 (元/MWh)</text>

      <!-- 图例 -->
      <text x="${padL + 10}" y="20" font-size="13" font-weight="600" fill="#1e293b">${node.name} — ${template.desc}</text>
      <text x="${xPos(currentP) + 10}" y="${yPos(currentCost) - 10}" font-size="11" fill="#ef4444">
        当前: ${Math.round(currentP)}MW, ${Math.round(currentCost)}元
      </text>

      <!-- X轴刻度 -->
      ${Array.from({length: 6}, (_, i) => {
        const p = (maxP / 5) * i;
        return `<text x="${xPos(p)}" y="${padT + ch + 20}" text-anchor="middle" font-size="10" fill="#94a3b8">${Math.round(p)}</text>`;
      }).join('')}
    </svg>
  `;

  showModal(
    `${node.name} 成本曲线`,
    `<div class="text-xs text-muted mb-2">节点类型: ${template.type} | 装机容量: ${node.capacity_mw}MW</div>
     ${svg}
     <div class="text-xs text-muted mt-2" style="line-height:1.7;">
       <strong>成本函数:</strong> C(P) = ${template.a > 0 ? template.a + 'P² + ' : ''}${template.b}P + ${template.c}<br/>
       <strong>边际成本:</strong> MC(P) = ${template.a > 0 ? (2*template.a) + 'P + ' : ''}${template.b}
     </div>`,
    'info'
  );
}

function showModal(title, body, type = 'info') {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const borderColor = type === 'error' ? 'var(--error)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)';
  overlay.innerHTML = `
    <div class="modal" style="border-top:3px solid ${borderColor};max-width:600px;">
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
