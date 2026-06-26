// ============================================================
// 云霄直流PTR沙盘系统 — 静态数据层
// ============================================================

// --- 常量 ---
export const P_FJ_CONTRACT = 390.0;   // 福清核电中长期合同价 (元/MWh)
export const C_LOSS = 20.0;           // 跨省网损代偿费 (元/MWh)
export const P_PENALTY = 10.0;        // 偏差扣罚 (元/MWh)
export const P_RATED = 2000;          // 额定物理容量 MW
export const P_STRATEGIC = 800;       // 战略协议预留 MW
export const P_SECURITY = 100;        // 安全裕度 MW
export const BID_MIN = 25.6;          // 限价下限
export const BID_MAX = 100.0;         // 限价上限

// --- 拓扑节点 ---
export const NODES = [
  { id: 'gen_fq',  name: '福清核电',   type: 'generator_nuclear', capacity_mw: 6600,  base_price: 390, x: 130, y: 80,  side: 'fj' },
  { id: 'gen_nd',  name: '宁德核电',   type: 'generator_nuclear', capacity_mw: 4356,  base_price: 380, x: 80,  y: 180, side: 'fj' },
  { id: 'gen_zz',  name: '漳州核电',   type: 'generator_nuclear', capacity_mw: 2200,  base_price: 385, x: 180, y: 260, side: 'fj' },
  { id: 'grid_fj', name: '福建主网',   type: 'grid_equivalent',   capacity_mw: 0,     base_price: 0,   x: 280, y: 170, side: 'fj' },
  { id: 'load_fj', name: '福建副负荷', type: 'load_equivalent',   capacity_mw: 0,     base_price: 0,   x: 220, y: 340, side: 'fj' },
  { id: 'cv_yx',   name: '云霄换流站', type: 'converter_fujian',  capacity_mw: 2000,  base_price: 0,   x: 390, y: 170, side: 'link' },
  { id: 'cv_ec',   name: '鹅城换流站', type: 'converter_guangdong', capacity_mw: 2000, base_price: 0,   x: 500, y: 170, side: 'link' },
  { id: 'grid_gd', name: '广东主网',   type: 'grid_equivalent',   capacity_mw: 0,     base_price: 0,   x: 610, y: 170, side: 'gd' },
  { id: 'gen_hm',  name: '华能海门',   type: 'generator_coal',    capacity_mw: 4000,  base_price: 450, x: 730, y: 80,  side: 'gd' },
  { id: 'gen_hz',  name: '惠州燃气',   type: 'generator_gas',     capacity_mw: 3000,  base_price: 650, x: 760, y: 260, side: 'gd' },
  { id: 'load_gd', name: '珠三角负荷', type: 'load_equivalent',   capacity_mw: 0,     base_price: 0,   x: 680, y: 350, side: 'gd' },
];

// --- 连线 ---
export const EDGES = [
  { from: 'gen_fq',  to: 'grid_fj', label: '核电基荷' },
  { from: 'gen_nd',  to: 'grid_fj', label: '远端支撑' },
  { from: 'gen_zz',  to: 'grid_fj', label: '近区支撑' },
  { from: 'grid_fj', to: 'cv_yx',   label: '外送通道', isLink: true },
  { from: 'cv_yx',   to: 'cv_ec',   label: '云霄直流', isDC: true },
  { from: 'cv_ec',   to: 'grid_gd', label: '受端入网' },
  { from: 'grid_gd', to: 'gen_hm',  label: '' },
  { from: 'grid_gd', to: 'gen_hz',  label: '' },
  { from: 'grid_gd', to: 'load_gd', label: '消纳中心' },
  { from: 'grid_fj', to: 'load_fj', label: '省内负荷' },
];

// --- 三场景数据 ---
export const SCENARIOS = {
  windy: {
    name: '寒潮大风',
    desc: '风电大发，核电满发，福建电力富余外送需求强',
    atc: 900,
    grid_constraint: 200,
    fj_spot: [220,200,180,150,110,80,90,150,240,280,280,240,150,180,180,240,310,350,380,390,380,350,310,240],
    gd_spot: [480,450,420,400,390,410,460,520,580,610,620,590,550,560,580,610,660,720,780,810,790,720,620,510],
  },
  hot: {
    name: '夏季尖峰',
    desc: '高温酷暑，广东负荷飙升，燃气顶峰，价差巨大',
    atc: 500,
    grid_constraint: 600,
    fj_spot: [320,310,300,280,280,290,320,350,380,410,420,390,350,360,380,410,450,480,510,520,510,480,420,350],
    gd_spot: [580,550,510,480,460,510,620,750,850,920,950,910,820,850,890,920,980,1000,1000,980,920,850,750,620],
  },
  flat: {
    name: '平枯普通',
    desc: '气温适宜，负荷平稳，通道充裕',
    atc: 1200,
    grid_constraint: 200,
    fj_spot: [360,350,340,330,330,340,360,380,410,430,440,410,380,390,410,430,450,460,470,480,470,450,410,380],
    gd_spot: [410,400,390,380,370,390,420,450,480,510,520,490,460,470,490,510,540,560,580,590,580,550,510,460],
  }
};

// --- AI虚拟对手 ---
export const AI_BIDDERS = [
  { name: '华能广东交易部',  type: 'aggressive', bidRange: [90, 100], qty: 200 },
  { name: '粤电大用户一',    type: 'rational',   bidRange: [70, 80],  qty: 150 },
  { name: '广汽售电中心',    type: 'rational',   bidRange: [60, 75],  qty: 120 },
  { name: '深能大用户二',    type: 'conservative', bidRange: [40, 50], qty: 100 },
  { name: '珠海售电公司',    type: 'ultra_cons', bidRange: [25.6, 35], qty: 80 },
];

// --- 生成31天月度数据（基于24h数据做日间波动） ---
export function generateMonthlyData(scenario) {
  const s = SCENARIOS[scenario];
  const days = [];
  for (let d = 0; d < 31; d++) {
    // 日间波动因子：±15%随机，但保持趋势
    const dayFactor = 0.85 + Math.sin(d * 0.3) * 0.08 + (d % 3) * 0.03;
    const dayFjSpot = s.fj_spot.map(v => Math.round(v * dayFactor));
    const dayGdSpot = s.gd_spot.map(v => Math.round(v * (dayFactor + (d % 5) * 0.02 - 0.02)));
    // ATC日间波动
    const dayAtc = Math.round(s.atc * (0.9 + (d % 4) * 0.05));
    days.push({
      day: d + 1,
      atc: dayAtc,
      fj_spot: dayFjSpot,
      gd_spot: dayGdSpot,
    });
  }
  return days;
}

// --- 生成AI对手某时段报价 ---
export function generateAIBids(scenario, hour) {
  const s = SCENARIOS[scenario];
  const spread = s.gd_spot[hour] - P_FJ_CONTRACT - C_LOSS;
  return AI_BIDDERS.map(b => {
    // 基于偏好范围，加入随机扰动
    const base = b.bidRange[0] + Math.random() * (b.bidRange[1] - b.bidRange[0]);
    // 价差大时激进型更愿意出高价
    const factor = spread > 200 ? 1.1 : spread > 100 ? 1.0 : 0.9;
    let price = base * factor;
    price = Math.max(BID_MIN, Math.min(BID_MAX, Math.round(price * 10) / 10));
    return { name: b.name, qty: b.qty, price };
  });
}
