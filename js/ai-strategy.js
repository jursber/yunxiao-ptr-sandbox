// ============================================================
// 云霄直流PTR沙盘系统 — AI自适应学习引擎
// ============================================================

class AdaptiveAdversary {
  constructor() {
    this.userBidHistory = [];  // 最近10次报价记录
    this.mcpHistory = [];       // 最近10次MCP记录
    this.saturationDetected = false;
    this.adaptiveMode = false;
    this.triggerTime = null;
  }

  // 记录用户报价和出清结果
  recordBid(userBid, userWon, winQty, atc, mcp) {
    this.userBidHistory.push({
      userBid,
      userWon,
      winQty,
      atc,
      mcp,
      timestamp: Date.now()
    });

    // 保持最近10次记录
    if (this.userBidHistory.length > 10) {
      this.userBidHistory.shift();
    }

    this.mcpHistory.push(mcp);
    if (this.mcpHistory.length > 10) {
      this.mcpHistory.shift();
    }

    // 检测饱和抢通策略
    this.saturationDetected = this.detectSaturation();
  }

  // 检测饱和抢通策略
  detectSaturation() {
    const recent3 = this.userBidHistory.slice(-3);
    if (recent3.length < 3) return false;

    // 计算市场平均MCP
    const avgMcp = this.mcpHistory.reduce((a, b) => a + b, 0) / this.mcpHistory.length;

    // 判定标准：
    // 1. 连续3次报价超过市场平均MCP的20%
    // 2. 连续3次都中标
    // 3. 连续3次中标容量占ATC的80%以上
    const allHighBid = recent3.every(r => r.userBid > avgMcp * 1.2);
    const allWon = recent3.every(r => r.userWon);
    const allSaturated = recent3.every(r => r.winQty / r.atc > 0.8);

    const isSaturation = allHighBid && allWon && allSaturated;

    if (isSaturation && !this.saturationDetected) {
      this.triggerTime = Date.now();
      this.adaptiveMode = true;
    }

    return isSaturation;
  }

  // 应用自适应策略
  applyAdaptiveStrategy(baseAIBids, userLastBid) {
    if (!this.saturationDetected || this.userBidHistory.length === 0) {
      return baseAIBids;
    }

    // 找到激进型AI对手
    const aggressiveIndex = baseAIBids.findIndex(b => b.name === '华能广东交易部');
    if (aggressiveIndex === -1) return baseAIBids;

    // AI贴身报价：在 [User_Bid + 0.5, User_Bid + 2.0] 之间
    const adjustedPrice = userLastBid + 0.5 + Math.random() * 1.5;

    // 确保在限价范围内
    baseAIBids[aggressiveIndex].price = Math.min(100, Math.max(25.6, adjustedPrice));

    return baseAIBids;
  }

  // 获取学习状态摘要
  getStatusSummary() {
    if (!this.saturationDetected) {
      return {
        active: false,
        message: 'AI处于正常报价模式'
      };
    }

    const recent3 = this.userBidHistory.slice(-3);
    const avgBid = recent3.reduce((sum, r) => sum + r.userBid, 0) / 3;
    const avgUtilization = recent3.reduce((sum, r) => sum + (r.winQty / r.atc), 0) / 3;

    return {
      active: true,
      mode: 'adaptive',
      message: `检测到连续3次饱和抢通策略`,
      details: {
        avgBid: avgBid.toFixed(1),
        avgUtilization: (avgUtilization * 100).toFixed(0) + '%',
        triggerTime: this.triggerTime
      }
    };
  }

  // 重置学习状态（页面刷新时自动调用）
  reset() {
    this.userBidHistory = [];
    this.mcpHistory = [];
    this.saturationDetected = false;
    this.adaptiveMode = false;
    this.triggerTime = null;
  }
}

// 导出单例
export const aiEngine = new AdaptiveAdversary();

// 修改原有的 generateAIBids 函数，集成自适应逻辑
export function generateAIBidsWithAdaptive(scenario, hour, baseGenerateFunc) {
  // 调用原始的AI报价生成函数
  let aiBids = baseGenerateFunc(scenario, hour);

  // 如果有用户历史记录，应用自适应策略
  if (aiEngine.userBidHistory.length > 0) {
    const lastUserBid = aiEngine.userBidHistory[aiEngine.userBidHistory.length - 1].userBid;
    aiBids = aiEngine.applyAdaptiveStrategy(aiBids, lastUserBid);
  }

  return aiBids;
}
