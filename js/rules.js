// ============================================================
// 云霄直流PTR沙盘系统 — 734号文规则知识库模块
// ============================================================
import { BID_MIN, BID_MAX, P_FJ_CONTRACT, C_LOSS } from './data.js';

export function initRules(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = buildHTML();
  bindEvents();
  renderMath();
}

function buildHTML() {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <!-- 左侧：条款索引 + 场景解析 -->
      <div class="flex flex-col gap-3">
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>734号文条款索引</h2>
          </div>
          <div class="panel-body">
            ${renderArticles()}
          </div>
        </div>

        <div class="panel" style="flex:1;">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>场景深度解析</h2>
          </div>
          <div class="panel-body">
            ${renderScenarioAnalysis()}
          </div>
        </div>
      </div>

      <!-- 右侧：FAQ + 公式 -->
      <div class="flex flex-col gap-3">
        <div class="panel">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>FAQ 常见问题</h2>
          </div>
          <div class="panel-body">
            ${renderFAQ()}
          </div>
        </div>

        <div class="panel" style="flex:1;">
          <div class="panel-header">
            <h2><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>核心计算模型</h2>
          </div>
          <div class="panel-body">
            <div id="formula-container">${renderFormulas()}</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderArticles() {
  const articles = [
    { id: '准入', title: '市场准入', content: '凡在广东电力交易中心注册的售电公司、电力大用户，以及在福建电力交易中心注册的发电企业，均可参与云霄直流输电权集中竞价。市场主体须具备中长期电力交易合同资质。' },
    { id: '限价', title: '申报限价', content: `根据第五条规定，输电权申报价格必须在 <strong>${BID_MIN} ~ ${BID_MAX} 元/MWh</strong> 之间。超出限价区间的报价将被系统自动拦截，不予参与出清。此限价区间旨在防止投机性报价扰乱市场秩序。` },
    { id: '出清', title: '出清机制', content: '采用边际统一出清（MCP）机制。所有申报按价格从高到低排序，依次累加容量直至达到可用通道容量（ATC），最后满足ATC的边际报价即为统一出清价。所有中标主体均按此统一价格结算。' },
    { id: '结算', title: '结算方式', content: '中标的输电权持有者，按统一出清价支付通道使用费。电能量合同与输电权分开结算。未中标者不支付通道费，但其中长期电能量合同将面临物理履约中断，需承担偏差考核或省内现货替代成本。' },
    { id: '容量', title: '通道容量管理', content: '云霄直流额定物理容量2000MW。扣除战略框架协议电量（约800MW）、网架安全约束（200-600MW）、安全裕度（100MW）后，剩余容量为市场化可交易容量（ATC）。网架约束根据实际运行工况动态调整。' },
    { id: '偏差', title: '偏差考核', content: '中标主体实际使用通道容量与中标容量的偏差超过±5%时，将按偏差电量收取偏差考核费用。未中标导致的中长期合同违约，按中长期交易规则承担违约责任。' },
  ];

  return articles.map(a => `
    <div class="card" style="cursor:default;">
      <div class="flex items-center justify-between mb-1">
        <span class="badge badge-primary">${a.id}</span>
        <span class="text-xs font-semibold text-ink">${a.title}</span>
      </div>
      <div class="text-xs text-body" style="line-height:1.7;">${a.content}</div>
    </div>
  `).join('');
}

function renderFAQ() {
  const faqs = [
    {
      q: '为什么买了电还要再买"通道"？',
      a: '在传统模式下，电能量和通道使用权是捆绑的。734号文实施后，两者解耦（量价解耦）。您在福建签约的购电合同只保证"有电可买"，但电要送到广东，还需要云霄直流这条"高速公路"的通行权。不买通道，电就过不去——类似于您买了机票，但机场跑道使用权需要另外竞拍。'
    },
    {
      q: '出清价是统一价，那我报高价会不会吃亏？',
      a: '不会。MCP机制下，所有中标者都按边际出清价（而非各自报价）结算。即使您报了100元，只要最终出清价是65元，您就只付65元。报高价的好处是提高中标概率，代价是您"愿意付更多"可能推高边际出清价（当您成为边际主体时）。'
    },
    {
      q: '不买PTR会有什么财务后果？',
      a: '如果您在福建签了中长期购电合同但没有拿到PTR通道权，电量无法物理送达广东。后果：1）广东终端负荷需以本地现货高价采购替代（夏季可达800-1000元/MWh）；2）福建侧合同面临偏差考核（10元/MWh罚金）；3）跨省套利机会完全丧失。'
    },
    {
      q: 'ATC为什么会变化？',
      a: '可用传输容量（ATC）= 额定容量2000MW - 战略预留800MW - 网架约束 - 安全裕度100MW。网架约束是动态的：正常时约200MW，但当福建南部500kV变电站检修或粤东主网重载时，调度会将约束提高到600MW甚至更多，ATC随之大幅缩水。'
    },
    {
      q: '理性报价的参考公式是什么？',
      a: `理性报价应确保到货综合成本低于广东现货价，留出合理利润空间。参考公式：<br/>
      <code>P_bid = P_GD_spot - P_FJ_contract - C_loss - 利润边际</code><br/>
      例如：广东现货价580元，利润边际15元 → P_bid = 580 - 390 - 20 - 15 = 155元，但受限价约束封顶为${BID_MAX}元。在价差巨大时（如夏季尖峰），${BID_MAX}元的限价可能成为所有理性主体的共同选择，导致出清价被推至上限。`
    },
  ];

  return faqs.map((f, i) => `
    <div class="faq-item">
      <div class="faq-q" data-idx="${i}">${f.q}<span class="arrow">▼</span></div>
      <div class="faq-a" data-idx="${i}">${f.a}</div>
    </div>
  `).join('');
}

function renderScenarioAnalysis() {
  const scenarios = [
    {
      id: 'flat',
      title: '日常运行',
      icon: '☀️',
      color: '#10b981',
      physics: '气温适宜，两省负荷平稳，通道容量充裕，价差适中，是最舒服的交易环境。',
      params: [
        { key: '两省电价', value: '平稳（闽330-480，粤370-590）', impact: '价差适中，套利空间稳定' },
        { key: 'ATC容量', value: '1200MW（最宽裕）', impact: '通道充裕，无物理约束' },
        { key: '网架约束', value: '200MW（最低）', impact: '系统运行平稳，无特殊约束' }
      ],
      consequence: '日常运行状态，通道最宽裕，价差适中。适合稳定套利，竞争相对温和。',
      strategy: '理性报价即可，关注价差波动。可适当降低报价以确保中标率，利润空间虽不如极端场景但风险可控。'
    },
    {
      id: 'windy',
      title: '寒潮大风（风电暴发场景）',
      icon: '🌬️',
      color: '#3b82f6',
      physics: '寒潮过境导致沿海风力极强，福建平潭、宁德等海上风电基地进入满发状态。此时段福建省内负荷相对有限，导致外送需求极度迫切，但直流通道瞬时超负荷。',
      params: [
        { key: '风电出力', value: '额定值95%以上', impact: '送端网架电压波动风险增大' },
        { key: 'ATC调整', value: '削减至900MW（45%）', impact: '调度侧为保证安全动态削减容量' },
        { key: '福建电价', value: '极低（80元/MWh）', impact: '出现负电价或超低电价' }
      ],
      consequence: '通道呈现"供大于求且容量受限"的拥挤状态。未中标PTR的交易员将面临巨额送端弃电损失或现货市场违约罚金。',
      strategy: '激进报价策略，接近上限抢通道。关注风电出力预测，提前布局。'
    },
    {
      id: 'hot',
      title: '夏季尖峰（高温网架重载场景）',
      icon: '🔥',
      color: '#ef4444',
      physics: '夏季高温导致两省电力负荷齐升。广东空调负荷占比极高，受端节点电价极度敏感。福建为保证核电出力安全，需严控网架潮流流向。',
      params: [
        { key: '广东电价', value: '1000元/MWh以上', impact: '燃气调峰机组驱动价格飙升' },
        { key: 'ATC压缩', value: '仅500MW', impact: '避免换流站过热及联络线过载' },
        { key: '稳控约束', value: '高度警惕模式', impact: '任何潮流波动触发告警' }
      ],
      consequence: '价格战最惨烈的场景。交易员报价极其趋近100元上限。中标即"发财"，落标即"巨亏"。',
      strategy: '最高价抢通道，容量尽量饱和。此场景下价差巨大，即使高价中标也能获得丰厚利润。'
    },
    {
      id: 'reverse',
      title: '反向潮流（价差逆转场景）',
      icon: '⚡',
      color: '#f59e0b',
      physics: '广东清洁能源过剩或福建核电检修，导致价差逆转。广东电价低于福建，电从粤送到闽，稳控约束加强。',
      params: [
        { key: '价差逆转', value: '粤380-620 < 闽480-760', impact: '反向套利机会出现' },
        { key: 'ATC削减', value: '700MW（中等）', impact: '反向潮流触发稳控约束' },
        { key: '网架约束', value: '450MW（高）', impact: '交流联络线电压稳定性下降' }
      ],
      consequence: '罕见但真实的场景。考察交易员对市场异常状态的应对能力。反向潮流下稳控约束更严格，ATC大幅削减。',
      strategy: '关注价差逆转预警信号。反向潮流时竞争格局可能改变，需重新评估对手策略。'
    }
  ];

  return scenarios.map(s => `
    <div class="card" style="border-left:4px solid ${s.color};margin-bottom:8px;cursor:pointer;" onclick="window.showScenarioDetail('${s.id}')">
      <div class="flex items-center gap-2 mb-2">
        <span style="font-size:20px;">${s.icon}</span>
        <span class="text-xs font-semibold text-ink">${s.title}</span>
      </div>
      <div class="text-xs text-body" style="line-height:1.7;margin-bottom:8px;">
        <strong>物理机理：</strong>${s.physics}
      </div>
      <div class="text-xs text-muted">点击查看详细参数与策略建议 →</div>
    </div>
  `).join('');
}

// 全局函数：显示场景详情
window.showScenarioDetail = function(scenarioId) {
  const scenarios = {
    flat: {
      title: '日常运行',
      icon: '☀️',
      color: '#10b981',
      params: [
        { key: '两省电价', value: '平稳（闽330-480，粤370-590）', impact: '价差适中，套利空间稳定' },
        { key: 'ATC容量', value: '1200MW（最宽裕）', impact: '通道充裕，无物理约束' },
        { key: '网架约束', value: '200MW（最低）', impact: '系统运行平稳，无特殊约束' }
      ],
      consequence: '日常运行状态，通道最宽裕，价差适中。适合稳定套利，竞争相对温和。',
      strategy: '理性报价即可，关注价差波动。可适当降低报价以确保中标率，利润空间虽不如极端场景但风险可控。'
    },
    windy: {
      title: '寒潮大风（风电暴发场景）',
      icon: '🌬️',
      color: '#3b82f6',
      params: [
        { key: '风电出力', value: '额定值95%以上', impact: '送端网架电压波动风险增大' },
        { key: 'ATC调整', value: '削减至900MW（45%）', impact: '调度侧为保证安全动态削减容量' },
        { key: '福建电价', value: '极低（80元/MWh）', impact: '出现负电价或超低电价' }
      ],
      consequence: '通道呈现"供大于求且容量受限"的拥挤状态。未中标PTR的交易员将面临巨额送端弃电损失或现货市场违约罚金。',
      strategy: '激进报价策略，接近上限抢通道。关注风电出力预测，提前布局。'
    },
    hot: {
      title: '夏季尖峰（高温网架重载场景）',
      icon: '🔥',
      color: '#ef4444',
      params: [
        { key: '广东电价', value: '1000元/MWh以上', impact: '燃气调峰机组驱动价格飙升' },
        { key: 'ATC压缩', value: '仅500MW', impact: '避免换流站过热及联络线过载' },
        { key: '稳控约束', value: '高度警惕模式', impact: '任何潮流波动触发告警' }
      ],
      consequence: '价格战最惨烈的场景。交易员报价极其趋近100元上限。中标即"发财"，落标即"巨亏"。',
      strategy: '最高价抢通道，容量尽量饱和。此场景下价差巨大，即使高价中标也能获得丰厚利润。'
    },
    reverse: {
      title: '反向潮流（价差逆转场景）',
      icon: '⚡',
      color: '#f59e0b',
      params: [
        { key: '价差逆转', value: '粤380-620 < 闽480-760', impact: '反向套利机会出现' },
        { key: 'ATC削减', value: '700MW（中等）', impact: '反向潮流触发稳控约束' },
        { key: '网架约束', value: '450MW（高）', impact: '交流联络线电压稳定性下降' }
      ],
      consequence: '罕见但真实的场景。考察交易员对市场异常状态的应对能力。反向潮流下稳控约束更严格，ATC大幅削减。',
      strategy: '关注价差逆转预警信号。反向潮流时竞争格局可能改变，需重新评估对手策略。'
    }
  };

  const s = scenarios[scenarioId];
  if (!s) return;

  const paramsTable = `
    <table class="data-table" style="margin:12px 0;">
      <thead><tr><th>参数</th><th>数值</th><th>影响</th></tr></thead>
      <tbody>
        ${s.params.map(p => `<tr><td class="font-semibold">${p.key}</td><td class="mono">${p.value}</td><td class="text-xs">${p.impact}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  const modalContent = `
    <div style="max-height:400px;overflow-y:auto;">
      <div class="flex items-center gap-2 mb-3">
        <span style="font-size:32px;">${s.icon}</span>
        <h3 class="text-lg font-bold" style="color:${s.color};">${s.title}</h3>
      </div>

      <div class="card" style="background:#f8fafc;margin-bottom:12px;">
        <div class="text-xs font-semibold text-muted uppercase mb-1">关键参数影响</div>
        ${paramsTable}
      </div>

      <div class="card" style="background:#fef2f2;border:1px solid #fecaca;margin-bottom:12px;">
        <div class="text-xs font-semibold text-error uppercase mb-1">⚠️ 运行后果</div>
        <div class="text-xs text-body" style="line-height:1.7;">${s.consequence}</div>
      </div>

      <div class="card" style="background:#f0fdf4;border:1px solid #bbf7d0;">
        <div class="text-xs font-semibold text-success uppercase mb-1">💡 策略建议</div>
        <div class="text-xs text-body" style="line-height:1.7;">${s.strategy}</div>
      </div>
    </div>
  `;

  showModal(s.title, modalContent, 'info');
};

function showModal(title, body, type = 'info') {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const borderColor = type === 'error' ? 'var(--error)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)';
  overlay.innerHTML = `
    <div class="modal" style="border-top:3px solid ${borderColor};max-width:700px;">
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

function renderFormulas() {
  return `
    <h3 class="mb-2" style="font-size:13px;color:var(--ink);">1. 通道可用容量计算</h3>
    <div class="formula-block">
      <div class="formula-latex">$$ATC(t) = P_{rated} - P_{strategic}(t) - P_{grid\\_constraint}(t) - P_{security\\_margin}(t)$$</div>
      <div class="formula-desc">
        <code>P_rated</code> = 2000MW（额定容量），
        <code>P_strategic</code> = 800MW（战略协议），
        <code>P_grid_constraint</code> = 200~600MW（网架约束），
        <code>P_security</code> = 100MW（安全裕度）
      </div>
    </div>

    <h3 class="mb-2 mt-3" style="font-size:13px;color:var(--ink);">2. 跨省到货综合总成本</h3>
    <div class="formula-block">
      <div class="formula-latex">$$C_{total} = (P_{FJ\\_contract} + P_{PTR\\_clear} + C_{loss}) \\times Q_{delivered}$$</div>
      <div class="formula-desc">
        <code>P_FJ_contract</code> = ${P_FJ_CONTRACT}元/MWh（福清核电合同价），
        <code>P_PTR_clear</code> = 统一出清价，
        <code>C_loss</code> = ${C_LOSS}元/MWh（网损代偿）
      </div>
    </div>

    <h3 class="mb-2 mt-3" style="font-size:13px;color:var(--ink);">3. 时段净损益</h3>
    <div class="formula-block">
      <div class="formula-latex">$$R_{net} = (P_{GD\\_spot} - P_{FJ\\_contract} - P_{PTR\\_clear} - C_{loss}) \\times Q_{delivered}$$</div>
      <div class="formula-desc">
        <code>P_GD_spot</code> = 广东日前现货价格。当 <code>R_net > 0</code> 时实现跨省套利收益。
      </div>
    </div>

    <h3 class="mb-2 mt-3" style="font-size:13px;color:var(--ink);">4. 理性报价参考公式</h3>
    <div class="formula-block">
      <div class="formula-latex">$$P_{bid}(t) = \\min(100, \\max(25.6,\\; P_{GD\\_spot}(t) - P_{FJ\\_contract} - C_{loss} - margin))$$</div>
      <div class="formula-desc">
        <code>margin</code> = 预留利润边际（建议15元/MWh）。此公式确保到货成本低于广东现货价，保留利润空间。实际报价还需考虑对手博弈和ATC供需关系。
      </div>
    </div>

    <h3 class="mb-2 mt-3" style="font-size:13px;color:var(--ink);">5. 未中标机会利润损失</h3>
    <div class="formula-block">
      <div class="formula-latex">$$Loss_{opportunity} = (P_{GD\\_spot} - P_{FJ\\_contract} - P_{PTR\\_clear} - C_{loss}) \\times Q_{user}$$</div>
      <div class="formula-desc">
        未中标时，跨省套利机会完全归零，同时需承担偏差扣罚和现货替代成本。
      </div>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll('.faq-q').forEach(el => {
    el.addEventListener('click', () => {
      const idx = el.dataset.idx;
      const answer = document.querySelector(`.faq-a[data-idx="${idx}"]`);
      const isOpen = el.classList.contains('open');
      // 关闭所有
      document.querySelectorAll('.faq-q').forEach(q => q.classList.remove('open'));
      document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('open'));
      // 切换当前
      if (!isOpen) {
        el.classList.add('open');
        answer?.classList.add('open');
      }
    });
  });
}

function renderMath() {
  // 使用MathJax渲染LaTeX公式
  function tryRender() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(() => {});
    } else {
      setTimeout(tryRender, 500);
    }
  }
  tryRender();
}
