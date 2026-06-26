// ============================================================
// 云霄直流PTR沙盘系统 — 主控制器
// ============================================================
import { SCENARIOS } from './data.js';
import { initTopology, updateTopology, resetTopology } from './topology.js';
import { initSingle, setSingleScenario } from './single.js';
import { initMulti, setMultiScenario } from './multi.js';
import { initRules } from './rules.js';

const AppState = {
  currentTab: 'topo',
  currentScenario: 'flat',
};

function switchTab(tab) {
  AppState.currentTab = tab;
  document.querySelectorAll('.tab-btn, .header-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
  });
}

function switchScenario(scenario) {
  AppState.currentScenario = scenario;
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scenario === scenario);
  });
  // 通知各模块
  updateTopology(scenario, false, null);
  setSingleScenario(scenario);
  setMultiScenario(scenario);
}

function init() {
  // Tab 绑定（支持header和workspace中的tabs）
  document.querySelectorAll('.tab-btn, .header-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 场景绑定
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => switchScenario(btn.dataset.scenario));
  });

  // 初始化各模块
  initTopology('topo-svg-container'); // Tab1: 静态完整拓扑
  initSingle('tab-single');
  initMulti('tab-multi');
  initRules('tab-rules');

  // 默认场景
  switchScenario('flat');
}

document.addEventListener('DOMContentLoaded', init);
