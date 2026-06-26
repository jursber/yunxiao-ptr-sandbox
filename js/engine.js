// ============================================================
// 云霄直流PTR沙盘系统 — 出清引擎 + 结算模型
// ============================================================
import { P_FJ_CONTRACT, C_LOSS, P_PENALTY, P_RATED, P_STRATEGIC, P_SECURITY, BID_MIN, BID_MAX, SCENARIOS } from './data.js';

// --- ATC计算 ---
export function calcATC(scenario) {
  const s = SCENARIOS[scenario];
  return P_RATED - P_STRATEGIC - s.grid_constraint - P_SECURITY;
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
    const opportunityLoss = Math.max(0, gdSpot - P_FJ_CONTRACT - C_LOSS) * bidQty;
    return {
      outcome: 'lost',
      winQty: 0,
      mcpPrice: result.mcpPrice,
      totalCost: 0,
      spotRevenue: 0,
      netProfit: -penaltyCost,
      delivered: 0,
      spread: 0,
      opportunityLoss,
      penaltyCost,
    };
  }
}

// --- 理性报价计算 ---
export function calcRationalBid(gdSpot, margin = 15) {
  const raw = gdSpot - P_FJ_CONTRACT - C_LOSS - margin;
  return Math.max(BID_MIN, Math.min(BID_MAX, Math.round(raw * 10) / 10));
}
