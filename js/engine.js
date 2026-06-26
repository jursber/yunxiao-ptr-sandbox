// ============================================================
// 云霄直流PTR沙盘系统 — 出清引擎 + 结算模型
// ============================================================
import { P_FJ_CONTRACT, C_LOSS, P_PENALTY, P_RATED, P_STRATEGIC, P_SECURITY, BID_MIN, BID_MAX, SCENARIOS } from './data.js';
import { calcWindOutput, calcWindATCAdjustment, getSeason } from './weather.js';

// 当前月份（用于气象计算）
let currentMonth = 6;

export function setCurrentMonth(month) {
  currentMonth = month;
}

// --- 潮流方向检测 ---
export function detectFlowDirection(scenario, hour = 12) {
  const s = SCENARIOS[scenario];

  // 如果场景明确指定了潮流方向，使用场景设置
  if (s.flow_direction) {
    return {
      direction: s.flow_direction,
      trigger: 'scenario',
      fjPrice: s.fj_spot[hour],
      gdPrice: s.gd_spot[hour]
    };
  }

  // 否则根据价格自动判断
  const fjPrice = s.fj_spot[hour];
  const gdPrice = s.gd_spot[hour];

  if (gdPrice < fjPrice) {
    return {
      direction: 'reverse',
      trigger: 'price_inversion',
      fjPrice,
      gdPrice
    };
  }

  return {
    direction: 'forward',
    trigger: 'normal',
    fjPrice,
    gdPrice
  };
}

// --- 风电出力计算 ---
export function getWindOutput(scenario, hour = 12) {
  const season = getSeason(currentMonth);
  const windRatedCapacity = 3000; // 平潭风电装机容量
  return calcWindOutput(windRatedCapacity, season, hour, scenario);
}

// --- ATC计算（集成风电和反向潮流） ---
export function calcATC(scenario, hour = 12, windOutput = null) {
  const s = SCENARIOS[scenario];
  const flowInfo = detectFlowDirection(scenario, hour);

  // 如果未提供风电出力，自动计算
  if (windOutput === null) {
    windOutput = getWindOutput(scenario, hour);
  }

  // 基础ATC计算
  let atc = P_RATED - P_STRATEGIC - s.grid_constraint - P_SECURITY;

  // 反向潮流时ATC受限
  if (flowInfo.direction === 'reverse') {
    // ATC_Reverse = min(Rated_DC_Capacity, Grid_Stability_Constraint)
    const stabilityLimit = P_RATED - P_STRATEGIC - s.grid_constraint - P_SECURITY;
    atc = Math.min(atc, stabilityLimit);
  }

  // 风电驱动的ATC调整
  const windAdjustment = calcWindATCAdjustment(windOutput);
  atc += windAdjustment;

  // 确保ATC非负
  atc = Math.max(0, atc);

  return {
    atc: Math.round(atc),
    windOutput,
    windAdjustment: Math.round(windAdjustment),
    flowDirection: flowInfo.direction,
    baseATC: P_RATED - P_STRATEGIC - s.grid_constraint - P_SECURITY,
    constraints: {
      strategic: P_STRATEGIC,
      grid: s.grid_constraint,
      security: P_SECURITY,
      wind: -windAdjustment
    }
  };
}

// --- 边际统一定价出清算法 (严格执行734号文) ---
export function runMCPClearing(userBid, userQty, atc, aiBidders) {
  // 1. 限价校验
  if (userBid < BID_MIN || userBid > BID_MAX) {
    throw new Error(`报价超出限价范围 [${BID_MIN}, ${BID_MAX}]`);
  }

  // 2. 合并队列
  const queue = [
    { name: '您（交易员）', qty: userQty, price: userBid, isUser: true, winQty: 0, status: 'Lost' },
    ...aiBidders.map(a => ({ ...a, isUser: false, winQty: 0, status: 'Lost' }))
  ];

  // 3. 价格降序排序
  queue.sort((a, b) => b.price - a.price);

  // 4. 累加裁剪
  let cumulative = 0;
  let clearingPrice = BID_MIN;
  let mcpFound = false;

  for (let i = 0; i < queue.length; i++) {
    const bid = queue[i];
    const prev = cumulative;
    cumulative += bid.qty;

    if (!mcpFound) {
      if (cumulative >= atc) {
        clearingPrice = bid.price;
        mcpFound = true;
        bid.status = 'Marginal';
        bid.winQty = atc - prev;
      } else {
        bid.winQty = bid.qty;
        bid.status = 'Won';
      }
    } else {
      bid.winQty = 0;
      bid.status = 'Lost';
    }
  }

  // 如果总需求未超过ATC，全部中标
  if (!mcpFound) {
    clearingPrice = queue.length > 0 ? queue[queue.length - 1].price : BID_MIN;
    for (const bid of queue) {
      bid.winQty = bid.qty;
      bid.status = 'Won';
    }
  }

  const userResult = queue.find(b => b.isUser);

  return {
    mcpPrice: clearingPrice,
    isUserWon: userResult.winQty > 0,
    userWinQty: userResult.winQty,
    userBidQty: userResult.qty,
    userStatus: userResult.status,
    fullQueue: queue,
    atc
  };
}

// --- 结算P&L计算 ---
export function calcSettlement(result, scenario, hour) {
  const s = SCENARIOS[scenario];
  const gdSpot = s.gd_spot[hour];
  const fjSpot = s.fj_spot[hour];
  const winQty = result.userWinQty;

  if (result.isUserWon && winQty > 0) {
    // 结局A：中标
    const totalCost = (P_FJ_CONTRACT + result.mcpPrice + C_LOSS) * winQty;
    const spotRevenue = gdSpot * winQty;
    const netProfit = spotRevenue - totalCost;
    return {
      outcome: 'won',
      winQty,
      mcpPrice: result.mcpPrice,
      totalCost,
      spotRevenue,
      netProfit,
      delivered: winQty,
      spread: gdSpot - P_FJ_CONTRACT - result.mcpPrice - C_LOSS,
      // 明细
      energyCost: P_FJ_CONTRACT * winQty,
      ptrCost: result.mcpPrice * winQty,
      lossCost: C_LOSS * winQty,
    };
  } else {
    // 结局B：未中标
    const bidQty = result.userBidQty || 0;
    const penaltyCost = P_PENALTY * bidQty;

    // 机会成本计算：若恰好报边际价即可中标
    const minWinningBid = result.mcpPrice;
    const potentialProfit = Math.max(0, (gdSpot - P_FJ_CONTRACT - minWinningBid - C_LOSS) * bidQty);
    const opportunityCostLoss = potentialProfit + penaltyCost;

    return {
      outcome: 'lost',
      winQty: 0,
      mcpPrice: result.mcpPrice,
      totalCost: 0,
      spotRevenue: 0,
      netProfit: -penaltyCost,
      delivered: 0,
      spread: 0,
      opportunityLoss: potentialProfit,
      opportunityCostLoss,
      penaltyCost,
      minWinningBid,
      potentialProfit,
    };
  }
}

// --- 物理阻塞检测 ---
export function detectPhysicalBlocking(scenario, hour, windOutput) {
  const s = SCENARIOS[scenario];
  const flowInfo = detectFlowDirection(scenario, hour);
  const constraints = [];

  // 反向潮流稳控约束
  if (flowInfo.direction === 'reverse' && s.grid_constraint > 400) {
    constraints.push({
      type: 'stability',
      icon: '⚡',
      reason: '反向潮流触发稳控装置约束',
      detail: '交流联络线电压稳定性下降，稳控装置自动限流',
      reduction: s.grid_constraint - 200,
      severity: 'high'
    });
  }

  // 风电大发导致通道拥挤
  if (windOutput > 2500) {
    const reduction = (windOutput - 2000) * 0.3;
    constraints.push({
      type: 'congestion',
      icon: '🌬️',
      reason: '风电大发导致送出通道拥挤',
      detail: `当前风电出力${windOutput}MW，超过通道消纳能力`,
      reduction: Math.round(reduction),
      severity: windOutput > 2800 ? 'high' : 'medium'
    });
  }

  // 网架约束异常高
  if (s.grid_constraint > 500) {
    constraints.push({
      type: 'grid',
      icon: '🔌',
      reason: '网架安全约束提升',
      detail: '福建南部500kV变电站检修或粤东主网重载',
      reduction: s.grid_constraint - 200,
      severity: 'medium'
    });
  }

  return constraints;
}

// --- 理性报价计算 ---
export function calcRationalBid(gdSpot, margin = 15) {
  const raw = gdSpot - P_FJ_CONTRACT - C_LOSS - margin;
  return Math.max(BID_MIN, Math.min(BID_MAX, Math.round(raw * 10) / 10));
}
