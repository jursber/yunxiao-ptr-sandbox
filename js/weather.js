// ============================================================
// 云霄直流PTR沙盘系统 — 气象驱动引擎
// ============================================================

// --- 季节定义（按月份） ---
export const SEASONS = {
  spring: [3, 4, 5],      // 春季：3-5月
  summer: [6, 7, 8],      // 夏季：6-8月（台风季）
  autumn: [9, 10, 11],    // 秋季：9-11月
  winter: [12, 1, 2],     // 冬季：12-2月（寒潮季）
};

// --- 获取当前季节 ---
export function getSeason(month) {
  if (SEASONS.spring.includes(month)) return 'spring';
  if (SEASONS.summer.includes(month)) return 'summer';
  if (SEASONS.autumn.includes(month)) return 'autumn';
  if (SEASONS.winter.includes(month)) return 'winter';
  return 'spring';
}

// --- 气象影响因子（风电出力系数） ---
export function getWeatherImpactFactor(season, hour, scenario) {
  // 基础出力系数（按季节）
  const baseFactors = {
    spring: 0.6,   // 春季平稳
    summer: 0.5,   // 夏季台风季，但台风来临前风力弱
    autumn: 0.55,  // 秋季适中
    winter: 0.75,  // 冬季寒潮，风力强
  };

  let factor = baseFactors[season] || 0.6;

  // 场景修正
  if (scenario === 'windy') {
    // 寒潮大风场景：风电满发
    factor = Math.min(1.0, factor + 0.3);
  } else if (scenario === 'hot') {
    // 夏季尖峰场景：风力弱
    factor = Math.max(0.3, factor - 0.2);
  }

  // 时段修正（风电日间波动）
  // 凌晨4-6时风力最强，中午12-14时风力最弱
  const hourFactor = 1.0 + 0.15 * Math.sin((hour - 6) * Math.PI / 12);
  factor *= hourFactor;

  // 随机波动 ±10%
  factor *= (0.9 + Math.random() * 0.2);

  // 限制在 0.3-1.0 之间
  return Math.max(0.3, Math.min(1.0, factor));
}

// --- 计算风电实际出力 ---
export function calcWindOutput(ratedCapacity, season, hour, scenario) {
  const impactFactor = getWeatherImpactFactor(season, hour, scenario);
  return Math.round(ratedCapacity * impactFactor);
}

// --- 气象事件描述 ---
export function getWeatherDescription(season, scenario) {
  if (scenario === 'windy') {
    if (season === 'winter') return '强寒潮过境，风电满发';
    if (season === 'spring') return '春季大风天气，风电高出力';
    return '强风天气，风电大发';
  }

  if (scenario === 'hot') {
    return '高温少风，风电出力降低';
  }

  const descriptions = {
    spring: '春季气候平稳，风电正常出力',
    summer: '夏季台风季前期，风力偏弱',
    autumn: '秋高气爽，风电适中出力',
    winter: '冬季偏冷，风电较高出力',
  };

  return descriptions[season] || '气象条件正常';
}

// --- 月度气象数据生成（31天） ---
export function generateMonthlyWeatherData(scenario, month = 6) {
  const season = getSeason(month);
  const days = [];

  for (let d = 0; d < 31; d++) {
    const hourlyFactors = [];
    for (let h = 0; h < 24; h++) {
      // 日间波动因子（模拟天气变化）
      const dayFactor = 0.85 + Math.sin(d * 0.3) * 0.1 + (d % 3) * 0.02;
      const factor = getWeatherImpactFactor(season, h, scenario) * dayFactor;
      hourlyFactors.push(factor);
    }

    days.push({
      day: d + 1,
      season,
      avgFactor: hourlyFactors.reduce((a, b) => a + b, 0) / 24,
      hourlyFactors,
    });
  }

  return days;
}

// --- 风电驱动的价格修正 ---
export function calcWindPriceImpact(windOutput, ratedCapacity) {
  // 风电出力占比
  const windRatio = windOutput / ratedCapacity;

  // 当风电出力 > 60% 时，开始压低福建现货价
  if (windRatio > 0.6) {
    const priceReduction = (windRatio - 0.6) * 0.5; // 最多降50%
    return -priceReduction;
  }

  return 0;
}

// --- 风电导致的ATC调整 ---
// 物理修正：风电出力不直接影响直流通道容量
// 风电大发影响的是市场博弈环境（更多主体抢通道）和价格信号（福建现货被压低）
// 通道容量由网架热稳极限和调度限流决定，不是风电出力的线性函数
export function calcWindATCAdjustment(windOutput) {
  return 0;
}

// --- 弃风风险评估 ---
export function calcCurtailmentRisk(windOutput, atc, userWinQty) {
  // 弃风风险得分 (0-100)
  const windRatio = windOutput / 3000; // 假设风电装机3000MW
  const channelUtilization = userWinQty / atc;

  let risk = 0;

  // 风电出力高 + 通道利用率高 = 高弃风风险
  if (windRatio > 0.8 && channelUtilization > 0.9) {
    risk = 80 + Math.random() * 20;
  } else if (windRatio > 0.7 && channelUtilization > 0.8) {
    risk = 50 + Math.random() * 20;
  } else if (windRatio > 0.6) {
    risk = 20 + Math.random() * 20;
  }

  return Math.round(risk);
}
