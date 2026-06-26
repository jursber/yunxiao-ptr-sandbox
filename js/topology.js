// ============================================================
// 云霄直流PTR沙盘系统 — SVG拓扑图模块
// ============================================================
import { NODES, EDGES, SCENARIOS, P_FJ_CONTRACT, C_LOSS } from './data.js';
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
  const vb = compact ? '60 60 760 320' : '0 0 880 440';
  const nodeR = compact ? 20 : 24;
  const convR = compact ? 22 : 28;
  const nameFontSize = compact ? 9 : 11;
  const subFontSize = compact ? 7 : 9;
  const tagFontSize = compact ? 7 : 9;

  function renderNodesCompact() {
    return NODES.map(n => {
      const isRef = n.type === 'load_equivalent' || n.type === 'grid_equivalent';
      const strokeDash = isRef ? 'stroke-dasharray="4 2"' : '';
      const isGen = n.type.startsWith('generator');
      const isLoad = n.type === 'load_equivalent';
      const isConverter = n.type.startsWith('converter');
      const nodeClass = wonNodes.has(n.id) ? 'topo-node-circle won' : 'topo-node-circle';
      const r = isConverter ? convR : nodeR;

      let tags = '';
      if (!compact) {
        if (isGen) {
          tags = `<rect x="${n.x - 33}" y="${n.y - r - 18}" width="66" height="18" rx="5" class="topo-tag topo-tag-gen"/>
            <text x="${n.x}" y="${n.y - r - 6}" text-anchor="middle" class="topo-tag-gen-text" font-size="${tagFontSize}" font-weight="600">发电 ${n.capacity_mw}MW</text>`;
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

      return `<g class="topo-node" data-id="${n.id}">
        <circle cx="${n.x}" cy="${n.y}" r="${r}" class="${nodeClass}" ${strokeDash}/>
        <text x="${n.x}" y="${n.y - 2}" class="topo-node-name" font-size="${nameFontSize}">${n.name}</text>
        ${n.base_price && !compact ? `<text x="${n.x}" y="${n.y + 12}" class="topo-node-sub">${n.base_price}元</text>` : ''}
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
      const marker = isDC ? `marker-end="url(#arrow${isBlocked ? 'Red' : 'Blue'})"` : '';
      let labelHtml = '';
      if (e.label && !compact) {
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2 - 8;
        labelHtml = `<text x="${mx}" y="${my}" class="topo-label" font-size="9">${e.label}</text>`;
      }
      // 联动：中标时DC连线变绿
      if (isDC && lastClearingResult && lastClearingResult.isUserWon) {
        cls = 'topo-edge dc-line flowing';
      }
      return `<line id="edge-${e.from}-${e.to}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${cls}" ${marker}/>${labelHtml}`;
    }).join('');
  }

  const atc = calcATC(currentScenario);
  const dcLabelY = compact ? 155 : 155;

  const svg = `<svg class="${compact ? 'topo-compact-svg' : 'topo-svg'}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">
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
    </defs>
    <rect width="880" height="440" fill="url(#grid${compact ? '-c' : ''})"/>

    ${!compact ? `
    <text x="160" y="25" class="topo-label" font-size="11" font-weight="600" fill="#64748b" letter-spacing="0.08em">华东 / 福建电网</text>
    <text x="660" y="25" class="topo-label" font-size="11" font-weight="600" fill="#64748b" letter-spacing="0.08em">南方 / 广东电网</text>
    <text x="410" y="120" class="topo-label" font-size="10" fill="#94a3b8">闽粤联网直流</text>
    ` : ''}

    ${renderEdgesCompact()}
    ${renderNodesCompact()}

    <g id="dc-label${compact ? '-c' : ''}" transform="translate(445, ${dcLabelY})">
      <rect x="-55" y="-22" width="110" height="44" rx="6" fill="rgba(255,255,255,0.92)" stroke="#d1d5db" stroke-width="1"/>
      <text x="0" y="-6" text-anchor="middle" font-size="${compact ? 9 : 11}" font-weight="600" fill="#1e293b" font-family="var(--mono)" id="dc-capacity${compact ? '-c' : ''}">ATC: ${atc}MW</text>
      <text x="0" y="10" text-anchor="middle" font-size="${compact ? 7 : 9}" fill="#10b981" id="dc-status${compact ? '-c' : ''}">状态: 正常</text>
    </g>
  </svg>`;
  container.innerHTML = svg;
}

// --- 更新拓扑（场景切换 + 出清联动） ---
export function updateTopology(scenario, isUserWon, clearingResult) {
  currentScenario = scenario;
  const s = SCENARIOS[scenario];
  const atc = calcATC(scenario);
  isBlocked = scenario === 'hot';
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
  const items = queue.map(b => {
    const dotCls = b.status === 'Won' ? 'won' : b.status === 'Marginal' ? 'marginal' : 'lost';
    const statusText = b.status === 'Won' ? '✓' : b.status === 'Marginal' ? '◐' : '✗';
    const name = b.isUser ? '您' : b.name;
    return `<div class="dispatch-item">
      <span class="dispatch-dot ${dotCls}"></span>
      <span class="dispatch-name">${name}</span>
      <span class="dispatch-price">${b.price}</span>
      <span class="text-xs" style="color:${dotCls === 'won' ? 'var(--success)' : dotCls === 'marginal' ? 'var(--warning)' : 'var(--dim)'};">${statusText}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="text-xs font-semibold text-muted uppercase mb-1">调度出清结果</div>
    <div class="dispatch-grid">${items}</div>
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
