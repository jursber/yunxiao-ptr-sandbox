// ============================================================
// 云霄直流PTR沙盘系统 — 风险评估模块（UIOLI风险雷达图）
// ============================================================

/**
 * UIOLI (Use It or Lose It) 风险评估
 * 当用户持有合同但落标时，计算偏差风险得分
 */

// --- 计算UIOLI风险得分 ---
export function calcUIolIRiskScore(contractVolume, localSpotPriceSpread, totalCapital) {
  // Risk Score = (Contract_Volume * Local_Spot_Price_Spread) / Total_Capital
  if (totalCapital <= 0) return 0;

  const score = (contractVolume * localSpotPriceSpread) / totalCapital;

  // 归一化到 0-100
  return Math.min(100, Math.max(0, score * 100));
}

// --- 风险等级判定 ---
export function getRiskLevel(score) {
  if (score >= 70) return { level: 'high', label: '高风险', color: '#ef4444' };
  if (score >= 40) return { level: 'medium', label: '中风险', color: '#f59e0b' };
  return { level: 'low', label: '低风险', color: '#10b981' };
}

// --- 计算多维度风险指标 ---
export function calcRiskDimensions(userBidHistory, clearResults, contractVolume = 100) {
  const dimensions = {
    deviationRisk: 0,      // 偏差风险
    opportunityRisk: 0,    // 机会损失风险
    priceVolatility: 0,    // 价格波动风险
    winningRate: 0,        // 中标率风险（低中标率=高风险）
    capacityUtilization: 0 // 容量利用率风险
  };

  if (!clearResults || clearResults.length === 0) {
    return dimensions;
  }

  // 1. 偏差风险：落标次数占比
  const lostCount = clearResults.filter(r => !r.result.isUserWon).length;
  dimensions.deviationRisk = (lostCount / clearResults.length) * 100;

  // 2. 机会损失风险：累计机会成本占合同价值比
  const totalOpportunityLoss = clearResults
    .filter(r => !r.result.isUserWon)
    .reduce((sum, r) => sum + (r.settlement.opportunityCostLoss || 0), 0);
  const contractValue = contractVolume * 390 * clearResults.length; // 假设合同价390元
  dimensions.opportunityRisk = Math.min(100, (totalOpportunityLoss / contractValue) * 100);

  // 3. 价格波动风险：MCP标准差
  const mcpList = clearResults.map(r => r.result.mcpPrice);
  const avgMcp = mcpList.reduce((a, b) => a + b, 0) / mcpList.length;
  const variance = mcpList.reduce((sum, mcp) => sum + Math.pow(mcp - avgMcp, 2), 0) / mcpList.length;
  const stdDev = Math.sqrt(variance);
  dimensions.priceVolatility = Math.min(100, (stdDev / avgMcp) * 200); // 归一化

  // 4. 中标率风险：100 - 中标率
  const wonCount = clearResults.filter(r => r.result.isUserWon).length;
  const winningRate = (wonCount / clearResults.length) * 100;
  dimensions.winningRate = 100 - winningRate;

  // 5. 容量利用率风险：平均利用率不足
  const avgUtilization = clearResults
    .filter(r => r.result.isUserWon)
    .reduce((sum, r) => sum + (r.result.userWinQty / r.result.atc), 0) / Math.max(1, wonCount);
  dimensions.capacityUtilization = (1 - avgUtilization) * 100;

  return dimensions;
}

// --- 渲染雷达图 SVG ---
export function renderRadarChart(dimensions, width = 400, height = 400) {
  const labels = [
    { key: 'deviationRisk', label: '偏差风险' },
    { key: 'opportunityRisk', label: '机会损失' },
    { key: 'priceVolatility', label: '价格波动' },
    { key: 'winningRate', label: '中标率风险' },
    { key: 'capacityUtilization', label: '容量利用率' }
  ];

  const center = { x: width / 2, y: height / 2 };
  const radius = Math.min(width, height) / 2 - 40;
  const angleStep = (2 * Math.PI) / labels.length;

  // 计算极坐标点
  function polarToCartesian(angle, value) {
    const r = (value / 100) * radius;
    return {
      x: center.x + r * Math.cos(angle - Math.PI / 2),
      y: center.y + r * Math.sin(angle - Math.PI / 2)
    };
  }

  // 绘制背景网格（5层）
  const gridLayers = [20, 40, 60, 80, 100];
  const gridSVG = gridLayers.map(level => {
    const points = labels.map((_, i) => {
      const angle = i * angleStep;
      const pt = polarToCartesian(angle, level);
      return `${pt.x},${pt.y}`;
    }).join(' ');
    return `<polygon points="${points}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  }).join('');

  // 绘制轴线
  const axisLines = labels.map((_, i) => {
    const angle = i * angleStep;
    const pt = polarToCartesian(angle, 100);
    return `<line x1="${center.x}" y1="${center.y}" x2="${pt.x}" y2="${pt.y}" stroke="#cbd5e1" stroke-width="1"/>`;
  }).join('');

  // 绘制数据多边形
  const dataPoints = labels.map((item, i) => {
    const angle = i * angleStep;
    const value = dimensions[item.key] || 0;
    return polarToCartesian(angle, value);
  });
  const dataPath = dataPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ') + 'Z';

  // 计算平均风险得分
  const avgRisk = Object.values(dimensions).reduce((a, b) => a + b, 0) / labels.length;
  const riskLevel = getRiskLevel(avgRisk);

  // 绘制标签
  const labelsSVG = labels.map((item, i) => {
    const angle = i * angleStep;
    const pt = polarToCartesian(angle, 110);
    const value = dimensions[item.key] || 0;
    return `
      <text x="${pt.x}" y="${pt.y}" text-anchor="middle" font-size="12" font-weight="600" fill="#475569">${item.label}</text>
      <text x="${pt.x}" y="${pt.y + 14}" text-anchor="middle" font-size="11" fill="${riskLevel.color}" font-family="var(--mono)">${value.toFixed(0)}</text>
    `;
  }).join('');

  // 绘制数据点
  const dotsSVG = dataPoints.map((pt, i) => {
    return `<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="${riskLevel.color}" stroke="white" stroke-width="2"/>`;
  }).join('');

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#f8fafc;border-radius:12px;">
      ${gridSVG}
      ${axisLines}
      <path d="${dataPath}" fill="${riskLevel.color}" fill-opacity="0.2" stroke="${riskLevel.color}" stroke-width="2"/>
      ${dotsSVG}
      ${labelsSVG}

      <!-- 中心标签 -->
      <circle cx="${center.x}" cy="${center.y}" r="50" fill="white" stroke="${riskLevel.color}" stroke-width="2"/>
      <text x="${center.x}" y="${center.y - 10}" text-anchor="middle" font-size="14" font-weight="600" fill="#475569">综合风险</text>
      <text x="${center.x}" y="${center.y + 10}" text-anchor="middle" font-size="24" font-weight="700" fill="${riskLevel.color}">${avgRisk.toFixed(0)}</text>
      <text x="${center.x}" y="${center.y + 28}" text-anchor="middle" font-size="12" fill="${riskLevel.color}">${riskLevel.label}</text>
    </svg>
  `;
}
