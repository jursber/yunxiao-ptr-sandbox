// ============================================================
// 云霄直流PTR沙盘系统 — 交易日历视图
// ============================================================
import { SCENARIOS, generateMonthlyData } from './data.js';
import { getSeason, getWeatherDescription } from './weather.js';
import { calcATC } from './engine.js';

// --- 判断是否为工作日 ---
export function isWeekday(dayOfMonth, month = 6, year = 2026) {
  const date = new Date(year, month - 1, dayOfMonth);
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // 1-5 为周一到周五
}

// --- 获取工作日/周末负荷调整系数 ---
export function getLoadAdjustmentFactor(isWeekday) {
  // 工作日负荷系数 1.0，周末负荷系数 0.75
  return isWeekday ? 1.0 : 0.75;
}

// --- 生成月度日历数据（集成气象+工作日） ---
export function generateCalendarData(scenario, month = 6, year = 2026) {
  const season = getSeason(month);
  const weatherDesc = getWeatherDescription(season, scenario);
  const monthlyData = generateMonthlyData(scenario);

  const calendarDays = monthlyData.map((day, index) => {
    const dayOfMonth = day.day;
    const isWD = isWeekday(dayOfMonth, month, year);
    const loadFactor = getLoadAdjustmentFactor(isWD);

    // 调整负荷曲线
    const adjustedFjSpot = day.fj_spot.map(v => Math.round(v * loadFactor));
    const adjustedGdSpot = day.gd_spot.map(v => Math.round(v * loadFactor));

    // 计算日均价
    const avgFj = adjustedFjSpot.reduce((a, b) => a + b, 0) / 24;
    const avgGd = adjustedGdSpot.reduce((a, b) => a + b, 0) / 24;

    // 获取ATC
    const atcInfo = calcATC(scenario, 12);

    return {
      day: dayOfMonth,
      isWeekday: isWD,
      loadFactor,
      fj_spot: adjustedFjSpot,
      gd_spot: adjustedGdSpot,
      avgFj: Math.round(avgFj),
      avgGd: Math.round(avgGd),
      atc: day.atc,
      season,
      weatherDesc,
      // 盈亏预估（假设用户报价65元，容量100MW）
      expectedProfit: calculateDayProfit(adjustedGdSpot, 65, 100)
    };
  });

  return {
    year,
    month,
    season,
    weatherDesc,
    days: calendarDays
  };
}

// --- 计算单日预估盈亏 ---
function calculateDayProfit(gdSpotArray, bidPrice, qty) {
  // 简化计算：假设全天中标
  const avgGdSpot = gdSpotArray.reduce((a, b) => a + b, 0) / 24;
  const costPerMWh = 390 + bidPrice + 20; // 合同价 + PTR + 网损
  const profitPerMWh = avgGdSpot - costPerMWh;
  return Math.round(profitPerMWh * qty * 24); // 一天24小时
}

// --- 渲染日历网格 ---
export function renderCalendarGrid(calendarData, containerWidth = 800) {
  const { year, month, season, weatherDesc, days } = calendarData;

  // 计算月度盈亏平衡点
  const totalProfit = days.reduce((sum, d) => sum + d.expectedProfit, 0);
  const breakEvenDays = days.filter(d => d.expectedProfit >= 0).length;

  const cellSize = 100;
  const gap = 8;
  const cols = 7;
  const rows = Math.ceil(days.length / cols);

  const gridHTML = days.map((day, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = col * (cellSize + gap);
    const y = row * (cellSize + gap);

    const profitColor = day.expectedProfit >= 0 ? '#10b981' : '#ef4444';
    const bgColor = day.isWeekday ? '#ffffff' : '#f8fafc';
    const borderColor = day.isWeekday ? '#d1d5db' : '#cbd5e1';

    return `
      <div class="calendar-cell" style="
        position:absolute;
        left:${x}px;
        top:${y}px;
        width:${cellSize}px;
        height:${cellSize}px;
        background:${bgColor};
        border:1px solid ${borderColor};
        border-radius:8px;
        padding:6px;
        cursor:pointer;
      " data-day="${day.day}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span class="text-xs font-semibold text-ink">${day.day}日</span>
          <span class="text-xs" style="color:${day.isWeekday ? '#64748b' : '#f59e0b'};">${day.isWeekday ? '工' : '休'}</span>
        </div>
        <div class="text-xs text-muted" style="line-height:1.5;">
          闽: <span class="mono">${day.avgFj}</span><br/>
          粤: <span class="mono">${day.avgGd}</span><br/>
          ATC: <span class="mono">${day.atc}</span>
        </div>
        <div class="text-xs font-semibold" style="color:${profitColor};margin-top:4px;">
          ${day.expectedProfit >= 0 ? '+' : ''}${(day.expectedProfit / 1000).toFixed(1)}k
        </div>
      </div>
    `;
  }).join('');

  const containerHeight = rows * (cellSize + gap);

  return `
    <div class="calendar-header" style="margin-bottom:12px;">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-ink">${year}年${month}月 交易日历</h3>
          <div class="text-xs text-muted mt-1">
            ${weatherDesc} · ${season === 'summer' ? '夏季' : season === 'winter' ? '冬季' : season === 'spring' ? '春季' : '秋季'} ·
            工作日 ${days.filter(d => d.isWeekday).length} 天 / 周末 ${days.filter(d => !d.isWeekday).length} 天
          </div>
        </div>
        <div class="card" style="padding:8px 12px;">
          <div class="text-xs text-muted">月度盈亏平衡</div>
          <div class="text-lg font-bold ${totalProfit >= 0 ? 'text-success' : 'text-error'}">
            ${totalProfit >= 0 ? '+' : ''}${(totalProfit / 1000).toFixed(0)}k
          </div>
          <div class="text-xs text-muted">${breakEvenDays}/${days.length}天盈利</div>
        </div>
      </div>
    </div>
    <div style="position:relative;width:${cols * (cellSize + gap)}px;height:${containerHeight}px;">
      ${gridHTML}
    </div>
    <div class="text-xs text-muted mt-3" style="line-height:1.7;">
      <strong>说明：</strong><br/>
      • 工作日负荷系数 1.0，周末负荷系数 0.75（电力需求降低）<br/>
      • 预估盈亏基于假设报价65元、容量100MW、全天中标计算<br/>
      • 点击日期单元格可查看该日24小时详细数据
    </div>
  `;
}

// --- 月度盈亏平衡点分析 ---
export function calcBreakEvenAnalysis(calendarData, userBidPrice = 65, userQty = 100) {
  const { days } = calendarData;

  // 计算各种场景下的盈亏
  const scenarios = [];

  for (let bidPrice = 50; bidPrice <= 80; bidPrice += 5) {
    let totalProfit = 0;
    let profitableDays = 0;

    for (const day of days) {
      const dayProfit = calculateDayProfit(day.gd_spot, bidPrice, userQty);
      totalProfit += dayProfit;
      if (dayProfit >= 0) profitableDays++;
    }

    scenarios.push({
      bidPrice,
      totalProfit,
      profitableDays,
      profitRate: (profitableDays / days.length) * 100
    });
  }

  // 找到盈亏平衡点
  const breakEvenScenario = scenarios.find(s => s.totalProfit >= 0) || scenarios[scenarios.length - 1];

  return {
    scenarios,
    breakEvenPrice: breakEvenScenario.bidPrice,
    recommendation: generateRecommendation(scenarios, userBidPrice)
  };
}

function generateRecommendation(scenarios, currentBid) {
  const currentScenario = scenarios.find(s => s.bidPrice === currentBid);
  if (!currentScenario) return '数据不足，无法生成建议';

  if (currentScenario.totalProfit > 0) {
    return `当前报价${currentBid}元可实现月度盈利，建议保持当前策略`;
  } else {
    const breakEven = scenarios.find(s => s.totalProfit >= 0);
    if (breakEven) {
      return `当前报价${currentBid}元将导致月度亏损，建议降低报价至${breakEven.bidPrice}元以实现盈亏平衡`;
    } else {
      return '当前市场环境下所有报价策略均无法盈利，建议暂停交易或调整合同规模';
    }
  }
}
