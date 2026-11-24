const fs = require('fs');
const path = require('path');

const dir = __dirname;
const jsonStr = fs.readFileSync(path.join(dir, 'hrsg_data.json'), 'utf8');
const simJsStr = fs.readFileSync(path.join(dir, 'hrsg_cfd_sim.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mô phỏng 3D CFD &amp; DCS — Lò thu hồi nhiệt HRSG</title>
<style>
  :root {
    --bg: #070d17;
    --panel: #0f172a;
    --panel2: #16223a;
    --border: #253657;
    --text: #e2e8f0;
    --muted: #94a3b8;
    --accent: #38bdf8;
    --green: #22c55e;
    --red: #ef4444;
    --amber: #f59e0b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    font-size: 13px;
  }
  header {
    height: 50px;
    background: #0b1324;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    gap: 10px;
    flex-shrink: 0;
  }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px; letter-spacing: .3px; }
  .brand .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); }
  .tab-group, .hb-group, .ctrl-group { display: flex; align-items: center; gap: 6px; }
  button {
    background: var(--panel2);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: .15s;
  }
  button:hover { border-color: var(--accent); background: #1d2f50; }
  button.active { background: #0284c7; border-color: #38bdf8; color: #fff; font-weight: 600; }
  button.hb-btn.active { background: #7c3aed; border-color: #a78bfa; color: #fff; }
  button.danger { background: #7f1d1d; border-color: #ef4444; color: #fecaca; }
  button.success { background: #14532d; border-color: #22c55e; color: #bbf7d0; }
  .alarm-pill {
    padding: 4px 10px; border-radius: 99px; font-weight: 700; font-size: 12px;
    background: #14532d; border: 1px solid #22c55e; color: #86efac; cursor: pointer;
  }
  .alarm-pill.has-alarm { background: #7f1d1d; border-color: #ef4444; color: #fecaca; animation: pulse 1.2s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .65; } }

  main { flex: 1; display: flex; overflow: hidden; position: relative; }
  .viewport { flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; }
  #canvas3d { width: 100%; height: 100%; display: block; cursor: grab; }
  #canvas3d:active { cursor: grabbing; }

  .hud-top-left {
    position: absolute; top: 10px; left: 10px; display: flex; flex-direction: column; gap: 6px; pointer-events: none;
  }
  .hud-row { display: flex; gap: 6px; flex-wrap: wrap; pointer-events: auto; }
  .hud-box {
    background: rgba(15, 23, 42, 0.86);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
    backdrop-filter: blur(6px);
  }
  .hud-kpi { display: flex; gap: 14px; font-size: 12px; }
  .hud-kpi div span { color: var(--muted); font-size: 11px; display: block; }
  .hud-kpi div strong { color: var(--accent); font-size: 13px; }

  .hud-bottom-left {
    position: absolute; bottom: 10px; left: 10px; right: 10px;
    display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none;
  }
  .colorbar {
    background: rgba(15, 23, 42, 0.88); border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 10px; pointer-events: auto; width: 250px;
  }
  .cb-bar { height: 10px; border-radius: 4px; margin: 4px 0; background: linear-gradient(90deg, #2563eb, #06b6d4, #22c55e, #eab308, #f97316, #ef4444); }
  .cb-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }
  .zone-bar { display: flex; gap: 5px; flex-wrap: wrap; pointer-events: auto; max-width: 72%; justify-content: flex-end; }
  .zone-chip {
    display: flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px;
    background: rgba(15,23,42,.9); border: 1px solid var(--border); cursor: pointer; font-size: 11px;
  }
  .zone-chip.active { border-color: #fff; background: #1e293b; font-weight: 700; }
  .zone-chip .swatch { width: 8px; height: 8px; border-radius: 2px; }

  aside {
    width: 360px;
    background: var(--panel);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 12px;
    gap: 10px;
    flex-shrink: 0;
  }
  .card {
    background: var(--panel2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
  }
  .card h3 { font-size: 13px; margin-bottom: 6px; color: var(--accent); display: flex; justify-content: space-between; align-items: center; }
  .tag-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .tag-table th, .tag-table td { padding: 4px 5px; border-bottom: 1px solid #1e2e4d; text-align: left; }
  .tag-table th { color: var(--muted); font-weight: 600; font-size: 11px; }
  .tag-val { font-family: Consolas, monospace; font-weight: 700; color: #38bdf8; text-align: right; }

  .criteria-list { list-style: none; display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }
  .criteria-item {
    display: flex; justify-content: space-between; align-items: center; gap: 6px;
    padding: 5px 7px; border-radius: 5px; background: #0f172a; border: 1px solid #1e293b; font-size: 11.5px;
  }
  .criteria-item.ok { border-color: #22c55e; background: rgba(34,197,94,.12); }
  .criteria-item.fail { border-color: #ef4444; background: rgba(239,68,68,.12); }
  .badge { padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px; }
  .badge.ok { background: #16a34a; color: #fff; }
  .badge.fail { background: #dc2626; color: #fff; }

  /* DCS & CFD Views */
  .view-pane { display: none; flex: 1; overflow-y: auto; padding: 14px; background: #091120; gap: 12px; flex-direction: column; }
  .view-pane.active { display: flex; }
  .dcs-grid { display: grid; grid-template-columns: 1.45fr 1fr; gap: 12px; }
  .dcs-svg-wrap { background: #050a14; border: 1px solid var(--border); border-radius: 8px; padding: 8px; }
  .faceplates { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
  .fp {
    background: #0d1629; border: 1px solid #2b3f66; border-radius: 8px; padding: 10px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .fp-head { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 12px; color: #7dd3fc; }
  .fp-row { display: flex; justify-content: space-between; font-size: 12px; font-family: Consolas, monospace; }
  .fp-bar { height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden; }
  .fp-bar > div { height: 100%; background: #38bdf8; transition: width .15s; }
  .fp input[type=range] { width: 100%; accent-color: #38bdf8; }
  .equip-ctrl { display: flex; flex-wrap: wrap; gap: 8px; }
  .equip-btn-box {
    background: #0d1629; border: 1px solid #2b3f66; border-radius: 8px; padding: 8px 10px;
    display: flex; align-items: center; gap: 8px;
  }
  .led { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .led.on { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
  .led.off { background: #ef4444; box-shadow: 0 0 8px #ef4444; }

  .alarm-drawer {
    position: absolute; top: 54px; right: 370px; width: 380px; max-height: 300px; overflow-y: auto;
    background: #111827; border: 1px solid #ef4444; border-radius: 8px; padding: 10px; z-index: 40;
    display: none; box-shadow: 0 12px 30px rgba(0,0,0,.6);
  }
  .alarm-drawer.open { display: block; }
  .alarm-row { padding: 5px 6px; border-bottom: 1px solid #1f2937; font-size: 12px; display: flex; justify-content: space-between; gap: 6px; }
  .alarm-row .lvl { font-weight: 700; color: #f87171; }
  .cfd-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .cfd-table th, .cfd-table td { padding: 6px 8px; border: 1px solid var(--border); text-align: right; }
  .cfd-table th { background: #132038; color: #7dd3fc; text-align: center; }
  .cfd-table td:nth-child(1), .cfd-table td:nth-child(2) { text-align: left; }
</style>
</head>
<body>

<header>
  <div class="brand">
    <span class="dot"></span>
    <span>MÔ PHỎNG 3D CFD &amp; DCS — LÒ THU HỒI NHIỆT HRSG (3 CẤP ÁP SUẤT)</span>
  </div>
  <div class="tab-group">
    <button id="tab3d" class="active" onclick="switchMainTab('3d')">Cảnh 3D &amp; CFD</button>
    <button id="tabDcs" onclick="switchMainTab('dcs')">Màn hình DCS (SVG)</button>
    <button id="tabCfd" onclick="switchMainTab('cfd')">Phân tích CFD 8 Module</button>
  </div>
  <div class="hb-group">
    <button id="hb_BASE_100" class="hb-btn active" onclick="selectLoadCase('BASE_100')">HB Base Load (100%)</button>
    <button id="hb_LOAD_85" class="hb-btn" onclick="selectLoadCase('LOAD_85')">HB 85% Load</button>
    <button id="hb_LOAD_50" class="hb-btn" onclick="selectLoadCase('LOAD_50')">HB 50% Load</button>
  </div>
  <div class="ctrl-group">
    <button id="btnPause" onclick="togglePause()">Tạm dừng</button>
    <button onclick="resetSim()">Đặt lại</button>
    <span id="alarmBadge" class="alarm-pill" onclick="toggleAlarmDrawer()">Cảnh báo: 0</span>
  </div>
</header>

<div id="alarmDrawer" class="alarm-drawer">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <strong style="color:#fca5a5;">DANH SÁCH CẢNH BÁO (ALARMS)</strong>
    <button onclick="toggleAlarmDrawer()" style="padding:2px 6px;">Đóng</button>
  </div>
  <div id="alarmList"></div>
</div>

<main>
  <!-- VIEW 1: 3D & CFD -->
  <div id="view3d" class="viewport">
    <canvas id="canvas3d"></canvas>
    <div class="hud-top-left">
      <div class="hud-row">
        <button id="cfdTemp" class="active" onclick="setCfdMode('temp')">CFD Nhiệt độ (°C)</button>
        <button id="cfdVel" onclick="setCfdMode('vel')">CFD Vận tốc (m/s)</button>
        <button id="cfdPres" onclick="setCfdMode('pres')">CFD Áp suất (barA)</button>
        <button id="cfdOff" onclick="setCfdMode('off')">Tắt lớp CFD</button>
        <button onclick="setCamPreset('iso')">Toàn cảnh 3D</button>
        <button onclick="setCamPreset('side')">Mặt cắt CFD</button>
        <button onclick="setCamPreset('plan')">Mặt bằng</button>
      </div>
      <div class="hud-box hud-kpi" id="hudKpi"></div>
    </div>
    <div class="hud-bottom-left">
      <div class="colorbar" id="cfdColorbar">
        <div style="font-size:11px;font-weight:700;color:#e2e8f0;" id="cbTitle">Trường nhiệt độ khói CFD (°C)</div>
        <div class="cb-bar"></div>
        <div class="cb-labels"><span id="cbMin">60°C</span><span id="cbMid">390°C</span><span id="cbMax">720°C</span></div>
      </div>
      <div class="zone-bar" id="zoneBar"></div>
    </div>
  </div>

  <!-- VIEW 2: SVG DCS -->
  <div id="viewDcs" class="view-pane">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h2 id="dcsTitle" style="font-size:16px;color:#38bdf8;">MÀN HÌNH DCS</h2>
      <div id="dcsZoneTabs" style="display:flex;gap:5px;flex-wrap:wrap;"></div>
    </div>
    <div id="dcsScenarioBanner" class="card" style="display:none;border-color:#f59e0b;"></div>
    <div class="dcs-grid">
      <div class="dcs-svg-wrap">
        <svg id="dcsSvg" viewBox="0 0 760 360" width="100%" style="display:block;"></svg>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px;">
        <h3>Biểu đồ xu hướng thời gian thực (Trend)</h3>
        <svg id="trendSvg" viewBox="0 0 420 220" width="100%" style="background:#050a14;border-radius:6px;border:1px solid #1e293b;"></svg>
        <div id="trendLegend" style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;"></div>
        <h3 style="margin-top:4px;">Điều khiển Thiết bị (Start / Stop / Khẩn cấp)</h3>
        <div id="dcsEquipCtrl" class="equip-ctrl"></div>
      </div>
    </div>
    <div class="card">
      <h3>Bộ điều khiển PID (Faceplate AUTO / MAN)</h3>
      <div id="dcsFaceplates" class="faceplates"></div>
    </div>
  </div>

  <!-- VIEW 3: CFD ANALYSIS -->
  <div id="viewCfd" class="view-pane">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="font-size:16px;color:#38bdf8;">PHÂN TÍCH ĐỘNG LỰC HỌC LƯU CHẤT (CFD) — 8 MODULE HRSG</h2>
      <span id="cfdSummaryBadge" style="color:#94a3b8;font-size:12px;"></span>
    </div>
    <div class="card">
      <h3>Biểu đồ phân bố Nhiệt độ &amp; Vận tốc dọc theo 8 Module trao đổi nhiệt</h3>
      <svg id="cfdProfileSvg" viewBox="0 0 900 220" width="100%" style="background:#050a14;border-radius:6px;border:1px solid #1e293b;"></svg>
    </div>
    <div class="card">
      <h3>Bảng thông số CFD chi tiết từng Module (Lưới 3D 20×6×4 = 480 ô lưới)</h3>
      <div style="overflow-x:auto;">
        <table class="cfd-table" id="cfdModuleTable"></table>
      </div>
    </div>
  </div>

  <!-- RIGHT PANEL -->
  <aside>
    <div class="card">
      <h3 id="panelZoneTitle">Khu vực</h3>
      <div id="panelZoneDesc" style="font-size:12px;color:var(--muted);margin-bottom:8px;"></div>
      <button class="active" style="width:100%;" onclick="switchMainTab('dcs')">Mở màn hình DCS (SVG) khu này</button>
    </div>

    <div class="card">
      <h3>
        <span>Kịch bản sự cố đào tạo</span>
        <span id="scStatusBadge" class="badge" style="display:none;"></span>
      </h3>
      <div id="scTitle" style="font-weight:700;font-size:12.5px;margin-bottom:4px;color:#fde68a;"></div>
      <div id="scSituation" style="font-size:11.5px;color:#cbd5e1;margin-bottom:4px;"></div>
      <div id="scProgression" style="font-size:11.5px;color:#94a3b8;margin-bottom:8px;"></div>
      <div style="display:flex;gap:6px;margin-bottom:6px;">
        <button id="btnStartSc" class="danger" style="flex:1;" onclick="toggleScenario()">Bắt đầu bài thi</button>
        <button onclick="toggleHint()">Gợi ý xử lý</button>
      </div>
      <div id="scHintBox" style="display:none;background:#0f172a;border:1px solid #38bdf8;border-radius:6px;padding:7px;font-size:11.5px;color:#bae6fd;margin-bottom:6px;"></div>
      <ul class="criteria-list" id="scCriteriaList"></ul>
    </div>

    <div class="card">
      <h3>Thông số Tag đang chạy</h3>
      <table class="tag-table">
        <thead><tr><th>Tag</th><th>Mô tả</th><th style="text-align:right;">Giá trị</th></tr></thead>
        <tbody id="panelTagsBody"></tbody>
      </table>
    </div>
  </aside>
</main>

<script>
// === EMBEDDED VERIFIED HRSG JSON DATA ===
const HRSG_DATA = ${jsonStr};

// === EMBEDDED VERIFIED CFD & DCS SIMULATION ENGINE ===
${simJsStr}

// === APPLICATION STATE ===
const sim = new HRSGSimulator(HRSG_DATA);
let selectedZoneId = 'EXHAUST_GAS';
let mainTab = '3d';
let cfdMode = 'temp'; // 'temp' | 'vel' | 'pres' | 'off'
let paused = false;
let showHint = false;

// 3D Camera state (smooth interpolation)
const cam = {
  target: [0, 11, 0], yaw: -0.62, pitch: 0.34, dist: 58,
  goalTarget: [0, 11, 0], goalYaw: -0.62, goalPitch: 0.34, goalDist: 58
};

// CFD 3D Streamline particles
const gasParticles = [];
for (let i = 0; i < 160; i++) {
  gasParticles.push({
    u: Math.random(),
    yFrac: 0.1 + Math.random() * 0.8,
    zFrac: 0.12 + Math.random() * 0.76,
    phase: Math.random() * Math.PI * 2
  });
}

// Pipe flow particles
const pipeParticles = [];
HRSG_DATA.lines.forEach((line, li) => {
  for (let i = 0; i < 10; i++) {
    pipeParticles.push({ lineIdx: li, t: i / 10 });
  }
});

// === HELPER FUNCTIONS ===
function heatColor(norm) {
  const c = Math.max(0, Math.min(1, norm));
  const stops = [
    [37, 99, 235],   // blue
    [6, 182, 212],   // cyan
    [34, 197, 94],   // green
    [234, 179, 8],   // yellow
    [249, 115, 22],  // orange
    [239, 68, 68]    // red
  ];
  const idx = c * (stops.length - 1);
  const i0 = Math.floor(idx), i1 = Math.min(stops.length - 1, i0 + 1);
  const f = idx - i0;
  const r = Math.round(stops[i0][0] + (stops[i1][0] - stops[i0][0]) * f);
  const g = Math.round(stops[i0][1] + (stops[i1][1] - stops[i0][1]) * f);
  const b = Math.round(stops[i0][2] + (stops[i1][2] - stops[i0][2]) * f);
  return \`rgb(\${r},\${g},\${b})\`;
}

function mediumColor(m) {
  const map = {
    flue_gas: '#f97316', hp_steam: '#ef4444', rh_steam: '#fb923c',
    ip_steam: '#facc15', lp_steam: '#38bdf8', feedwater: '#22c55e',
    condensate: '#06b6d4', blowdown: '#ec4899'
  };
  return map[m] || '#94a3b8';
}

function getZone(id) { return HRSG_DATA.zones.find(z => z.id === id); }
function getScenarioForZone(zid) { return HRSG_DATA.scenarios.find(s => s.zone === zid); }

// === UI CONTROLS ===
function switchMainTab(tab) {
  mainTab = tab;
  document.getElementById('tab3d').classList.toggle('active', tab === '3d');
  document.getElementById('tabDcs').classList.toggle('active', tab === 'dcs');
  document.getElementById('tabCfd').classList.toggle('active', tab === 'cfd');
  document.getElementById('view3d').style.display = tab === '3d' ? 'flex' : 'none';
  document.getElementById('viewDcs').classList.toggle('active', tab === 'dcs');
  document.getElementById('viewCfd').classList.toggle('active', tab === 'cfd');
  if (tab === 'dcs') renderDCSStatic();
  if (tab === 'cfd') renderCFDTable();
}

function selectLoadCase(caseId) {
  sim.setLoadCase(caseId);
  ['BASE_100', 'LOAD_85', 'LOAD_50'].forEach(id => {
    document.getElementById('hb_' + id).classList.toggle('active', id === caseId);
  });
  updateRightPanel();
  if (mainTab === 'dcs') renderDCSStatic();
  if (mainTab === 'cfd') renderCFDTable();
}

function selectZone(zoneId) {
  selectedZoneId = zoneId;
  const z = getZone(zoneId);
  if (z && z.camera) {
    cam.goalTarget = [...z.camera.target];
    cam.goalYaw = z.camera.yaw;
    cam.goalPitch = z.camera.pitch;
    cam.goalDist = z.camera.dist;
  }
  showHint = false;
  document.getElementById('scHintBox').style.display = 'none';
  renderZoneChips();
  updateRightPanel();
  if (mainTab === 'dcs') renderDCSStatic();
}

function setCfdMode(mode) {
  cfdMode = mode;
  ['Temp', 'Vel', 'Pres', 'Off'].forEach(k => {
    document.getElementById('cfd' + k).classList.toggle('active', k.toLowerCase() === mode);
  });
  const cb = document.getElementById('cfdColorbar');
  if (mode === 'off') { cb.style.display = 'none'; return; }
  cb.style.display = 'block';
  if (mode === 'temp') {
    document.getElementById('cbTitle').textContent = 'Trường nhiệt độ khói CFD (°C)';
    document.getElementById('cbMin').textContent = '60°C';
    document.getElementById('cbMid').textContent = '390°C';
    document.getElementById('cbMax').textContent = '720°C';
  } else if (mode === 'vel') {
    document.getElementById('cbTitle').textContent = 'Trường vận tốc dòng khói CFD (m/s)';
    document.getElementById('cbMin').textContent = '2 m/s';
    document.getElementById('cbMid').textContent = '9 m/s';
    document.getElementById('cbMax').textContent = '16 m/s';
  } else {
    document.getElementById('cbTitle').textContent = 'Trường áp suất khói CFD (barA)';
    document.getElementById('cbMin').textContent = '1.009';
    document.getElementById('cbMid').textContent = '1.035';
    document.getElementById('cbMax').textContent = '1.065';
  }
}

function setCamPreset(p) {
  if (p === 'iso') { cam.goalTarget = [2, 11, 2]; cam.goalYaw = -0.62; cam.goalPitch = 0.34; cam.goalDist = 60; }
  if (p === 'side') { cam.goalTarget = [2, 10, 0]; cam.goalYaw = 0.0; cam.goalPitch = 0.04; cam.goalDist = 54; }
  if (p === 'plan') { cam.goalTarget = [2, 4, 2]; cam.goalYaw = 0.0; cam.goalPitch = 1.42; cam.goalDist = 64; }
}

function togglePause() {
  paused = !paused;
  document.getElementById('btnPause').textContent = paused ? 'Tiếp tục' : 'Tạm dừng';
}

function resetSim() {
  sim.initState(sim.loadCaseId);
  updateRightPanel();
  if (mainTab === 'dcs') renderDCSStatic();
}

function toggleAlarmDrawer() {
  document.getElementById('alarmDrawer').classList.toggle('open');
}

function toggleHint() {
  showHint = !showHint;
  document.getElementById('scHintBox').style.display = showHint ? 'block' : 'none';
}

function toggleScenario() {
  const sc = getScenarioForZone(selectedZoneId);
  if (!sc) return;
  if (sim.activeScenario && sim.activeScenario.id === sc.id) {
    sim.stopScenario();
    sim.initState(sim.loadCaseId);
  } else {
    sim.startScenario(sc.id);
    ['BASE_100', 'LOAD_85', 'LOAD_50'].forEach(id => {
      document.getElementById('hb_' + id).classList.toggle('active', id === sim.loadCaseId);
    });
  }
  updateRightPanel();
  if (mainTab === 'dcs') renderDCSStatic();
}

function renderZoneChips() {
  const bar = document.getElementById('zoneBar');
  const dcsTabs = document.getElementById('dcsZoneTabs');
  bar.innerHTML = '';
  dcsTabs.innerHTML = '';
  HRSG_DATA.zones.forEach(z => {
    const chip = document.createElement('div');
    chip.className = 'zone-chip' + (z.id === selectedZoneId ? ' active' : '');
    chip.innerHTML = \`<span class="swatch" style="background:\${z.color}"></span><span>\${z.short_name}</span>\`;
    chip.onclick = () => selectZone(z.id);
    bar.appendChild(chip);

    const btn = document.createElement('button');
    btn.className = z.id === selectedZoneId ? 'active' : '';
    btn.textContent = z.short_name;
    btn.onclick = () => selectZone(z.id);
    dcsTabs.appendChild(btn);
  });
}

function updateRightPanel() {
  const z = getZone(selectedZoneId);
  const sc = getScenarioForZone(selectedZoneId);
  document.getElementById('panelZoneTitle').textContent = z.name;
  const eqCount = HRSG_DATA.equipment.filter(e => e.zone === z.id).length;
  document.getElementById('panelZoneDesc').textContent = \`Gồm \${eqCount} cụm thiết bị chính. Nhấp nút bên dưới để thao tác trực tiếp trên màn hình DCS.\`;

  // Scenario box
  const isActive = sim.activeScenario && sim.activeScenario.id === sc.id;
  document.getElementById('scTitle').textContent = sc.title;
  document.getElementById('scSituation').innerHTML = \`<strong>Tình huống:</strong> \${sc.situation}\`;
  document.getElementById('scProgression').innerHTML = \`<strong>Diễn biến:</strong> \${sc.progression}\`;
  document.getElementById('scHintBox').innerHTML = \`<strong>Cách xử lý đúng:</strong> \${sc.correct_action}\`;

  const btn = document.getElementById('btnStartSc');
  btn.textContent = isActive ? 'Dừng bài thi' : 'Bắt đầu bài thi';
  btn.className = isActive ? 'success' : 'danger';

  const badge = document.getElementById('scStatusBadge');
  const critUl = document.getElementById('scCriteriaList');
  if (isActive && sim.scenarioResult) {
    badge.style.display = 'inline-block';
    badge.textContent = sim.scenarioResult.status_vi + ' (' + sim.scenarioResult.elapsed_s + 's)';
    badge.className = 'badge ' + (sim.scenarioResult.passed ? 'ok' : 'fail');
    critUl.innerHTML = sim.scenarioResult.details.map(d => \`
      <li class="criteria-item \${d.ok ? 'ok' : 'fail'}">
        <span>\${d.label}</span>
        <strong>\${d.value} \${d.ok ? '✓' : '✗'}</strong>
      </li>
    \`).join('');
  } else {
    badge.style.display = 'none';
    critUl.innerHTML = sc.criteria.map(c => \`
      <li class="criteria-item">
        <span>\${c.label}</span>
        <span style="color:#94a3b8;">\${sim.tags[c.tag] !== undefined ? sim.tags[c.tag].toFixed(1) : '-'}</span>
      </li>
    \`).join('');
  }

  // Live tags table
  const insts = HRSG_DATA.instruments.filter(i => i.zone === z.id);
  document.getElementById('panelTagsBody').innerHTML = insts.map(i => \`
    <tr>
      <td style="font-family:Consolas,monospace;color:#7dd3fc;">\${i.tag}</td>
      <td>\${i.description}</td>
      <td class="tag-val">\${sim.tags[i.tag] !== undefined ? sim.tags[i.tag].toFixed(i.unit === 'barA' ? 2 : 1) : '-'} \${i.unit}</td>
    </tr>
  \`).join('');

  // HUD KPIs
  const s = sim.cfdGrid.summary;
  document.getElementById('hudKpi').innerHTML = \`
    <div><span>Kịch bản HB</span><strong>\${s.load_case}</strong></div>
    <div><span>Lưu lượng khói</span><strong>\${s.mass_flow_tph} t/h</strong></div>
    <div><span>T_vào → T_ống khói</span><strong>\${s.t_inlet_c}°C → \${s.t_stack_c}°C</strong></div>
    <div><span>Sụt áp ΔP</span><strong>\${s.dp_total_mbar} mbar</strong></div>
    <div><span>Nhiệt thu hồi Q</span><strong>\${s.total_heat_duty_mw} MW</strong></div>
  \`;

  // Alarms
  const ab = document.getElementById('alarmBadge');
  ab.textContent = 'Cảnh báo: ' + sim.alarms.length;
  ab.classList.toggle('has-alarm', sim.alarms.length > 0);
  document.getElementById('alarmList').innerHTML = sim.alarms.length === 0
    ? '<div style="color:#86efac;padding:6px;">Hệ thống vận hành bình thường — Không có cảnh báo.</div>'
    : sim.alarms.map(a => \`<div class="alarm-row"><span class="lvl">[\${a.level}] \${a.tag}</span><span>\${a.msg}</span></div>\`).join('');
}

// === DCS SVG SCREEN & FACEPLATES ===
function renderDCSStatic() {
  const z = getZone(selectedZoneId);
  document.getElementById('dcsTitle').textContent = 'MÀN HÌNH DCS — ' + z.name.toUpperCase();

  // Equipment Start/Stop buttons relevant to zone (or all pumps if utility/cph)
  const ctrlBox = document.getElementById('dcsEquipCtrl');
  ctrlBox.innerHTML = '';
  const eqButtons = [];
  if (selectedZoneId === 'CPH_SYSTEM') {
    eqButtons.push({ tag: 'P1LCB10AP001', label: 'Bơm tuần hoàn CPH A' }, { tag: 'P1LCB10AP002', label: 'Bơm tuần hoàn CPH B' });
  } else if (selectedZoneId === 'BLOWDOWN_UTILITY') {
    eqButtons.push({ tag: 'P1LCQ93AP001', label: 'Bơm chuyển xả đáy A' }, { tag: 'P1LCQ93AP002', label: 'Bơm chuyển xả đáy B' });
  } else if (selectedZoneId === 'EXHAUST_GAS') {
    eqButtons.push({ tag: 'P1HNA91AT001', label: 'Máy hút ẩm Dehumidifier' });
    const wrap = document.createElement('div');
    wrap.className = 'equip-btn-box';
    wrap.innerHTML = \`<span>Van ống khói P1HNE91AA001</span><button class="success" onclick="openStackDamperEmergency()">MỞ 100% KHẨN CẤP</button>\`;
    ctrlBox.appendChild(wrap);
  }
  eqButtons.forEach(b => {
    const on = sim.equipState[b.tag];
    const div = document.createElement('div');
    div.className = 'equip-btn-box';
    div.innerHTML = \`
      <span class="led \${on ? 'on' : 'off'}" id="led_\${b.tag}"></span>
      <div>
        <div style="font-weight:700;font-size:11.5px;">\${b.label}</div>
        <div style="font-size:10.5px;color:#94a3b8;">\${b.tag}</div>
      </div>
      <button class="success" onclick="cmdEquip('\${b.tag}', true)">START</button>
      <button class="danger" onclick="cmdEquip('\${b.tag}', false)">STOP</button>
    \`;
    ctrlBox.appendChild(div);
  });
  if (ctrlBox.children.length === 0) {
    ctrlBox.innerHTML = '<span style="color:#94a3b8;font-size:12px;">Khu vực này điều khiển qua các vòng PID bên dưới.</span>';
  }

  // PID Faceplates for this zone
  const zoneTags = HRSG_DATA.instruments.filter(i => i.zone === selectedZoneId && i.is_control_loop).map(i => i.tag);
  // Also include HP Drum LIC on HP_ECO screen for convenience
  if (selectedZoneId === 'HP_ECO' && !zoneTags.includes('P1HAD91CL911')) zoneTags.push('P1HAD91CL911');

  const fpWrap = document.getElementById('dcsFaceplates');
  fpWrap.innerHTML = '';
  zoneTags.forEach(tag => {
    const pid = sim.pids[tag];
    if (!pid) return;
    const spMin = pid.unit === 'mm' ? -150 : pid.unit === 'barA' ? 2 : pid.unit === '%' ? 0 : Math.max(0, Math.round(pid.sp - 80));
    const spMax = pid.unit === 'mm' ? 150 : pid.unit === 'barA' ? 45 : pid.unit === '%' ? 100 : Math.round(pid.sp + 80);
    const el = document.createElement('div');
    el.className = 'fp';
    el.id = 'fp_' + tag;
    el.innerHTML = \`
      <div class="fp-head">
        <span>\${pid.tag} (\${pid.name})</span>
        <span style="display:flex;gap:4px;">
          <button id="mAuto_\${tag}" class="\${pid.mode==='AUTO'?'active':''}" style="padding:2px 6px;" onclick="setPidMode('\${tag}','AUTO')">AUTO</button>
          <button id="mMan_\${tag}" class="\${pid.mode==='MAN'?'danger':''}" style="padding:2px 6px;" onclick="setPidMode('\${tag}','MAN')">MAN</button>
        </span>
      </div>
      <div style="font-size:11px;color:#94a3b8;">Phần tử chấp hành: <strong>\${pid.actuator}</strong></div>
      <div class="fp-row"><span>PV:</span><strong id="fpPv_\${tag}">\${pid.pv.toFixed(1)} \${pid.unit}</strong></div>
      <div class="fp-row"><span>SP:</span><strong id="fpSp_\${tag}">\${pid.sp.toFixed(1)} \${pid.unit}</strong></div>
      <input type="range" id="slSp_\${tag}" min="\${spMin}" max="\${spMax}" step="0.5" value="\${pid.sp}" oninput="setPidSp('\${tag}', this.value)">
      <div class="fp-row"><span>OP (Van):</span><strong id="fpOp_\${tag}">\${pid.op.toFixed(1)}%</strong></div>
      <div class="fp-bar"><div id="barOp_\${tag}" style="width:\${pid.op}%"></div></div>
      <input type="range" id="slOp_\${tag}" min="0" max="100" step="1" value="\${pid.op}" \${pid.mode==='AUTO'?'disabled':''} oninput="setPidOp('\${tag}', this.value)">
    \`;
    fpWrap.appendChild(el);
  });
  updateDCSDynamic();
}

function cmdEquip(tag, on) {
  sim.setEquipmentState(tag, on);
  const led = document.getElementById('led_' + tag);
  if (led) led.className = 'led ' + (on ? 'on' : 'off');
}

function openStackDamperEmergency() {
  sim.pids.P1HNE91CG001.setMode('AUTO');
  sim.pids.P1HNE91CG001.setSP(100);
  renderDCSStatic();
}

function setPidMode(tag, mode) {
  sim.pids[tag].setMode(mode);
  renderDCSStatic();
}

function setPidSp(tag, val) {
  sim.pids[tag].setSP(Number(val));
  document.getElementById('fpSp_' + tag).textContent = Number(val).toFixed(1) + ' ' + sim.pids[tag].unit;
}

function setPidOp(tag, val) {
  sim.pids[tag].setOP(Number(val));
  document.getElementById('fpOp_' + tag).textContent = Number(val).toFixed(1) + '%';
  document.getElementById('barOp_' + tag).style.width = val + '%';
}

function updateDCSDynamic() {
  // Update Scenario Banner inside DCS
  const banner = document.getElementById('dcsScenarioBanner');
  if (sim.activeScenario) {
    banner.style.display = 'block';
    const r = sim.scenarioResult;
    banner.innerHTML = \`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <strong style="color:#fde68a;">BÀI THI ĐANG CHẠY: \${sim.activeScenario.title}</strong>
        <span class="badge \${r && r.passed ? 'ok' : 'fail'}">\${r ? r.status_vi : 'CHƯA ĐẠT'} (\${r ? r.elapsed_s : 0}s)</span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;">
        \${r ? r.details.map(d => \`<span style="color:\${d.ok ? '#86efac' : '#fca5a5'}">\${d.ok ? '✓' : '✗'} \${d.label} [Hiện tại: \${d.value}]</span>\`).join('') : ''}
      </div>
    \`;
  } else {
    banner.style.display = 'none';
  }

  // Update Faceplates live values
  for (const tag in sim.pids) {
    const pid = sim.pids[tag];
    const pvEl = document.getElementById('fpPv_' + tag);
    if (pvEl) {
      pvEl.textContent = pid.pv.toFixed(pid.unit === 'barA' ? 2 : 1) + ' ' + pid.unit;
      document.getElementById('fpOp_' + tag).textContent = pid.op.toFixed(1) + '%';
      document.getElementById('barOp_' + tag).style.width = pid.op + '%';
      if (pid.mode === 'AUTO') {
        const sl = document.getElementById('slOp_' + tag);
        if (sl) sl.value = pid.op;
      }
    }
  }

  // Render Zone SVG Schematic
  const svg = document.getElementById('dcsSvg');
  const eqs = HRSG_DATA.equipment.filter(e => e.zone === selectedZoneId);
  const insts = HRSG_DATA.instruments.filter(i => i.zone === selectedZoneId);
  const z = getZone(selectedZoneId);
  let markup = \`
    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/>
      </marker>
    </defs>
    <rect x="8" y="8" width="744" height="344" rx="8" fill="#070e1c" stroke="\${z.color}" stroke-width="1.5" stroke-opacity="0.6"/>
    <text x="22" y="30" fill="\${z.color}" font-size="13" font-weight="700">SƠ ĐỒ CÔNG NGHỆ DCS — \${z.short_name.toUpperCase()} (\${sim.hb.name})</text>
  \`;

  // Draw process flow header line
  markup += \`<line x1="40" y1="165" x2="720" y2="165" stroke="#1e3a5f" stroke-width="6" stroke-dasharray="10,6" marker-end="url(#arr)"/>\`;

  // Draw equipment blocks evenly across schematic
  const stepX = 660 / Math.max(eqs.length, 1);
  eqs.forEach((eq, idx) => {
    const cx = 60 + idx * stepX + stepX / 2;
    const isPump = eq.type === 'pump';
    const isOn = sim.equipState[eq.tag];
    const fill = isPump ? (isOn ? '#14532d' : '#7f1d1d') : '#112240';
    const stroke = isPump ? (isOn ? '#22c55e' : '#ef4444') : z.color;
    if (isPump) {
      markup += \`
        <circle cx="\${cx}" cy="165" r="28" fill="\${fill}" stroke="\${stroke}" stroke-width="2.5"/>
        <polygon points="\${cx-8},\${155} \${cx+12},\${165} \${cx-8},\${175}" fill="#e2e8f0"/>
        <text x="\${cx}" y="210" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="700">\${eq.tag}</text>
        <text x="\${cx}" y="224" text-anchor="middle" fill="\${isOn?'#86efac':'#fca5a5'}" font-size="10">\${isOn?'ĐANG CHẠY':'DỪNG'}</text>
      \`;
    } else {
      const w = Math.min(130, stepX - 18);
      markup += \`
        <rect x="\${cx - w/2}" y="115" width="\${w}" height="100" rx="8" fill="\${fill}" stroke="\${stroke}" stroke-width="2"/>
        <text x="\${cx}" y="155" text-anchor="middle" fill="#7dd3fc" font-size="11" font-weight="700">\${eq.tag}</text>
        <text x="\${cx}" y="172" text-anchor="middle" fill="#cbd5e1" font-size="10">\${eq.name.split('(')[0].slice(0,20)}</text>
      \`;
    }
  });

  // Draw live instrument callout boxes along top & bottom
  insts.forEach((inst, idx) => {
    const row = idx % 2;
    const col = Math.floor(idx / 2);
    const x = 30 + col * 175;
    const y = row === 0 ? 48 : 265;
    const v = sim.tags[inst.tag];
    const isAlarm = sim.alarms.some(a => a.tag === inst.tag);
    markup += \`
      <rect x="\${x}" y="\${y}" width="162" height="48" rx="6" fill="#0d1930" stroke="\${isAlarm ? '#ef4444' : '#334155'}" stroke-width="\${isAlarm ? 2 : 1}"/>
      <text x="\${x+8}" y="\${y+16}" fill="#94a3b8" font-size="10" font-family="Consolas">\${inst.tag} [\${inst.type}]</text>
      <text x="\${x+8}" y="\${y+36}" fill="\${isAlarm ? '#fca5a5' : '#38bdf8'}" font-size="15" font-weight="700" font-family="Consolas">\${v !== undefined ? v.toFixed(inst.unit==='barA'?2:1) : '-'} \${inst.unit}</text>
    \`;
  });
  svg.innerHTML = markup;

  // Render Trend Chart
  const tSvg = document.getElementById('trendSvg');
  const tLegend = document.getElementById('trendLegend');
  const plotInsts = insts.slice(0, 3);
  const colors = ['#38bdf8', '#f59e0b', '#22c55e'];
  let tMarkup = '<line x1="36" y1="10" x2="36" y2="195" stroke="#334155"/><line x1="36" y1="195" x2="405" y2="195" stroke="#334155"/>';
  tLegend.innerHTML = '';
  plotInsts.forEach((inst, pi) => {
    const vals = sim.history.map(h => h[inst.tag]).filter(v => v !== undefined);
    if (vals.length < 2) return;
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mx - mn < 2) { mn -= 2; mx += 2; }
    const pts = vals.map((v, i) => {
      const px = 38 + (i / Math.max(1, vals.length - 1)) * 364;
      const py = 190 - ((v - mn) / (mx - mn)) * 172;
      return \`\${px.toFixed(1)},\${py.toFixed(1)}\`;
    }).join(' ');
    tMarkup += \`<polyline fill="none" stroke="\${colors[pi]}" stroke-width="2" points="\${pts}"/>\`;
    tLegend.innerHTML += \`<span style="color:\${colors[pi]};">■ \${inst.tag}: <strong>\${vals[vals.length-1].toFixed(1)} \${inst.unit}</strong></span>\`;
  });
  tSvg.innerHTML = tMarkup;
}

// === CFD 8-MODULE ANALYSIS TABLE & CHART ===
function renderCFDTable() {
  const s = sim.cfdGrid.summary;
  document.getElementById('cfdSummaryBadge').textContent =
    \`\${s.load_case} | Khói: \${s.mass_flow_tph} t/h | Tổng nhiệt thu hồi: \${s.total_heat_duty_mw} MW | ΔP: \${s.dp_total_mbar} mbar\`;

  let html = \`<thead><tr>
    <th>#</th><th>Module trao đổi nhiệt</th><th>T_vào (°C)</th><th>T_ra (°C)</th>
    <th>Áp suất (barA)</th><th>Sụt áp (Pa)</th><th>Khối lượng riêng (kg/m³)</th>
    <th>v_mặt (m/s)</th><th>v_khe ống (m/s)</th><th>Re</th><th>Nu</th><th>h (W/m²K)</th><th>Nhiệt Q (MW)</th>
  </tr></thead><tbody>\`;
  s.modules.forEach(m => {
    html += \`<tr>
      <td>M\${m.index}</td><td>\${m.name}</td><td>\${m.tIn_c}</td><td>\${m.tOut_c}</td>
      <td>\${m.p_bara}</td><td>\${m.dp_pa}</td><td>\${m.rho_kgm3}</td>
      <td>\${m.v_face_ms}</td><td>\${m.v_max_ms}</td><td>\${m.reynolds}</td><td>\${m.nusselt}</td><td>\${m.h_wm2k}</td>
      <td style="color:#38bdf8;font-weight:700;">\${m.heat_duty_mw}</td>
    </tr>\`;
  });
  html += '</tbody>';
  document.getElementById('cfdModuleTable').innerHTML = html;

  // Profile SVG
  const svg = document.getElementById('cfdProfileSvg');
  let p = '<line x1="50" y1="20" x2="50" y2="185" stroke="#334155"/><line x1="50" y1="185" x2="860" y2="185" stroke="#334155"/>';
  const tPts = [], vPts = [];
  s.modules.forEach((m, i) => {
    const x = 80 + i * 105;
    const yT = 180 - (m.tIn_c / 750) * 150;
    const yV = 180 - (m.v_max_ms / 16) * 150;
    tPts.push(\`\${x},\${yT.toFixed(1)}\`);
    vPts.push(\`\${x},\${yV.toFixed(1)}\`);
    p += \`<text x="\${x}" y="202" text-anchor="middle" fill="#94a3b8" font-size="11">M\${m.index}</text>\`;
    p += \`<circle cx="\${x}" cy="\${yT.toFixed(1)}" r="4" fill="#ef4444"/><text x="\${x}" y="\${(yT-8).toFixed(1)}" text-anchor="middle" fill="#fca5a5" font-size="10">\${m.tIn_c}°C</text>\`;
    p += \`<circle cx="\${x}" cy="\${yV.toFixed(1)}" r="4" fill="#38bdf8"/><text x="\${x}" y="\${(yV+14).toFixed(1)}" text-anchor="middle" fill="#7dd3fc" font-size="10">\${m.v_max_ms}m/s</text>\`;
  });
  p += \`<polyline fill="none" stroke="#ef4444" stroke-width="2.5" points="\${tPts.join(' ')}"/>\`;
  p += \`<polyline fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="6,4" points="\${vPts.join(' ')}"/>\`;
  p += \`<text x="680" y="25" fill="#fca5a5" font-size="11">● Nhiệt độ khói (°C)</text><text x="680" y="42" fill="#7dd3fc" font-size="11">● Vận tốc khe ống (m/s)</text>\`;
  svg.innerHTML = p;
}

// === ZERO-DEPENDENCY 3D PERSPECTIVE CANVAS ENGINE ===
const canvas = document.getElementById('canvas3d');
const ctx = canvas.getContext('2d');
let dragging = false, lastX = 0, lastY = 0;

canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', () => dragging = false);
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  cam.goalYaw += dx * 0.007;
  cam.goalPitch = Math.max(0.03, Math.min(1.45, cam.goalPitch + dy * 0.007));
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.goalDist = Math.max(16, Math.min(110, cam.goalDist + e.deltaY * 0.04));
}, { passive: false });

function project(x, y, z, w, h) {
  const dx = x - cam.target[0];
  const dy = y - cam.target[1];
  const dz = z - cam.target[2];
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  // Rotate Y (yaw)
  const rx = dx * cy - dz * sy;
  const rz1 = dx * sy + dz * cy;
  // Rotate X (pitch)
  const ry = dy * cp - rz1 * sp;
  const rz = dy * sp + rz1 * cp + cam.dist;
  if (rz < 1.0) return null;
  const fov = Math.min(w, h) * 0.92;
  return { sx: w * 0.5 + (rx / rz) * fov, sy: h * 0.54 - (ry / rz) * fov, depth: rz, scale: fov / rz };
}

function drawQuad3D(pts3, fill, stroke, alpha) {
  const w = canvas.width, h = canvas.height;
  const proj = pts3.map(p => project(p[0], p[1], p[2], w, h));
  if (proj.some(p => !p)) return;
  const avgD = proj.reduce((s, p) => s + p.depth, 0) / proj.length;
  return { type: 'quad', proj, fill, stroke, alpha: alpha !== undefined ? alpha : 1, depth: avgD };
}

function addBoxPrimitives(list, cx, cy, cz, sx, sy, sz, color, alpha, wireframe) {
  const x0 = cx - sx/2, x1 = cx + sx/2;
  const y0 = cy - sy/2, y1 = cy + sy/2;
  const z0 = cz - sz/2, z1 = cz + sz/2;
  const faces = [
    { pts: [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], shade: 1.15 }, // top
    { pts: [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], shade: 0.95 }, // front
    { pts: [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]], shade: 0.72 }, // back
    { pts: [[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]], shade: 0.85 }, // right
    { pts: [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], shade: 0.65 }  // left
  ];
  faces.forEach(f => {
    const q = drawQuad3D(f.pts, shadeHex(color, f.shade), wireframe ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.55)', alpha);
    if (q) list.push(q);
  });
}

function shadeHex(hex, mult) {
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * mult));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * mult));
  const b = Math.min(255, Math.round((n & 255) * mult));
  return \`rgb(\${r},\${g},\${b})\`;
}

function render3D() {
  if (mainTab !== '3d') return;
  const rect = canvas.parentElement.getBoundingClientRect();
  if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }
  const w = canvas.width, h = canvas.height;

  // Smooth camera fly-to
  for (let i = 0; i < 3; i++) cam.target[i] += (cam.goalTarget[i] - cam.target[i]) * 0.1;
  cam.yaw += (cam.goalYaw - cam.yaw) * 0.1;
  cam.pitch += (cam.goalPitch - cam.pitch) * 0.1;
  cam.dist += (cam.goalDist - cam.dist) * 0.1;

  // Clear dark background
  const grad = ctx.createRadialGradient(w*0.5, h*0.45, 40, w*0.5, h*0.5, Math.max(w, h)*0.75);
  grad.addColorStop(0, '#0f1c33');
  grad.addColorStop(1, '#060b14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Ground grid
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
  ctx.lineWidth = 1;
  for (let gx = -30; gx <= 34; gx += 4) {
    const p1 = project(gx, 0, -16, w, h), p2 = project(gx, 0, 20, w, h);
    if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke(); }
  }
  for (let gz = -16; gz <= 20; gz += 4) {
    const p1 = project(-30, 0, gz, w, h), p2 = project(34, 0, gz, w, h);
    if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke(); }
  }

  const drawList = [];

  // 1. Colored Zone Floor Pads
  HRSG_DATA.zones.forEach(z => {
    const p = z.pad;
    const isSel = z.id === selectedZoneId;
    const q = drawQuad3D([
      [p.x - p.w/2, 0.05, p.z - p.d/2],
      [p.x + p.w/2, 0.05, p.z - p.d/2],
      [p.x + p.w/2, 0.05, p.z + p.d/2],
      [p.x - p.w/2, 0.05, p.z + p.d/2]
    ], z.color, isSel ? '#ffffff' : z.color, isSel ? 0.30 : 0.13);
    if (q) { q.depth += 50; drawList.push(q); }
  });

  // 2. 3D Equipment Blocks (shaded boxes, drums, tall stack, pumps with LEDs)
  HRSG_DATA.equipment.forEach(eq => {
    const z = getZone(eq.zone);
    const [x, y, zc] = eq.pos;
    const [sx, sy, sz] = eq.size;
    const isCasingModule = ['superheater', 'reheater', 'evaporator', 'economizer', 'condensate_preheater'].includes(eq.type) && sy > 10;
    const alpha = isCasingModule && cfdMode !== 'off' ? 0.28 : 0.88;
    const col = eq.tag === 'P1HNE91BS001' ? '#334155' : (eq.type === 'pump' ? '#1e293b' : z.color);
    addBoxPrimitives(drawList, x, y, zc, sx, sy, sz, col, alpha, isCasingModule);

    // Pump glowing status LED beacon
    if (eq.type === 'pump') {
      const on = sim.equipState[eq.tag];
      const lp = project(x, y + sy/2 + 0.9, zc, w, h);
      if (lp) {
        drawList.push({
          type: 'dot', sx: lp.sx, sy: lp.sy, r: Math.max(4, lp.scale * 0.45),
          color: on ? '#22c55e' : '#ef4444', glow: true, depth: lp.depth - 0.5, label: eq.tag
        });
      }
    }
    // Stack platforms (reference 3D-HRSG.jpg)
    if (eq.tag === 'P1HNE91BS001') {
      [16, 23, 30, 37].forEach(py => {
        addBoxPrimitives(drawList, x, py, zc, sx + 1.8, 0.35, sz + 1.8, '#1d4ed8', 0.85, false);
      });
    }
  });

  // 3. 3D CFD Volumetric Heatmap Slice (center plane z = 0)
  if (cfdMode !== 'off') {
    const cells = sim.cfdGrid.cells;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.iz !== 1) continue; // mid-plane cutaway for crisp visibility
      let norm = 0;
      if (cfdMode === 'temp') norm = (c.T - 60) / 660;
      else if (cfdMode === 'vel') norm = (c.speed - 2) / 14;
      else norm = (c.P - 1.009) / 0.056;
      const col = heatColor(norm);
      const cw = 2.4, ch = 2.6;
      const q = drawQuad3D([
        [c.x - cw/2, c.y - ch/2, 0],
        [c.x + cw/2, c.y - ch/2, 0],
        [c.x + cw/2, c.y + ch/2, 0],
        [c.x - cw/2, c.y + ch/2, 0]
      ], col, null, 0.42);
      if (q) drawList.push(q);
    }
  }

  // 4. 3D CFD Gas Streamline Particles
  const damperFactor = sim.tags.P1HNE91CG001 / 100.0;
  gasParticles.forEach(gp => {
    if (!paused) {
      gp.u = (gp.u + 0.0045 * (sim.hb.flue_gas.mass_flow_tph / 2631.1)) % 1.0;
    }
    let gx, gy, gz;
    if (gp.u < 0.82) {
      const f = gp.u / 0.82;
      gx = -24 + f * 49;
      const hSpan = f < 0.18 ? (4 + f * 55) : 14;
      gy = 2.2 + gp.yFrac * hSpan + (1 - damperFactor) * Math.sin(gp.phase + sim.time * 4) * 1.6 * f;
      gz = (gp.zFrac - 0.5) * 9.5;
    } else {
      const f = (gp.u - 0.82) / 0.18;
      gx = 26.5 + Math.cos(gp.phase) * 1.4;
      gy = 10 + f * 31;
      gz = Math.sin(gp.phase) * 1.4;
    }
    const tApprox = sim.hb.flue_gas.inlet_temp_c * (1 - gp.u) + sim.tags.P1HNE91CT001 * gp.u;
    const col = cfdMode === 'vel' ? '#38bdf8' : heatColor((tApprox - 60) / 660);
    const p = project(gx, gy, gz, w, h);
    if (p) {
      drawList.push({ type: 'dot', sx: p.sx, sy: p.sy, r: Math.max(2, p.scale * 0.22), color: col, glow: false, depth: p.depth });
    }
  });

  // 5. Pipes & Animated Flow Particles
  HRSG_DATA.lines.forEach((line, li) => {
    const col = mediumColor(line.medium);
    for (let i = 0; i < line.path.length - 1; i++) {
      const p1 = project(...line.path[i], w, h);
      const p2 = project(...line.path[i+1], w, h);
      if (p1 && p2) {
        drawList.push({ type: 'line', x1: p1.sx, y1: p1.sy, x2: p2.sx, y2: p2.sy, color: col, depth: (p1.depth + p2.depth) / 2 });
      }
    }
  });

  pipeParticles.forEach(pp => {
    const line = HRSG_DATA.lines[pp.lineIdx];
    const flow = sim.tags[line.flow_tag] || 0;
    if (!paused && flow > 0.5) {
      pp.t = (pp.t + 0.003 + Math.min(0.012, flow / 45000)) % 1.0;
    }
    const segs = line.path.length - 1;
    const pos = pp.t * segs;
    const si = Math.min(segs - 1, Math.floor(pos));
    const sf = pos - si;
    const a = line.path[si], b = line.path[si + 1];
    const px = a[0] + (b[0] - a[0]) * sf;
    const py = a[1] + (b[1] - a[1]) * sf;
    const pz = a[2] + (b[2] - a[2]) * sf;
    const pr = project(px, py, pz, w, h);
    if (pr && flow > 0.5) {
      drawList.push({ type: 'dot', sx: pr.sx, sy: pr.sy, r: Math.max(2.5, pr.scale * 0.24), color: '#ffffff', glow: true, depth: pr.depth - 0.2 });
    }
  });

  // Painter's depth sort (back to front)
  drawList.sort((a, b) => b.depth - a.depth);

  for (let i = 0; i < drawList.length; i++) {
    const item = drawList[i];
    if (item.type === 'quad') {
      ctx.save();
      ctx.globalAlpha = item.alpha;
      ctx.beginPath();
      ctx.moveTo(item.proj[0].sx, item.proj[0].sy);
      for (let k = 1; k < item.proj.length; k++) ctx.lineTo(item.proj[k].sx, item.proj[k].sy);
      ctx.closePath();
      ctx.fillStyle = item.fill;
      ctx.fill();
      if (item.stroke) { ctx.strokeStyle = item.stroke; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.restore();
    } else if (item.type === 'line') {
      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(item.x1, item.y1);
      ctx.lineTo(item.x2, item.y2);
      ctx.stroke();
      ctx.restore();
    } else if (item.type === 'dot') {
      ctx.save();
      if (item.glow) { ctx.shadowColor = item.color; ctx.shadowBlur = 10; }
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(item.sx, item.sy, item.r, 0, Math.PI * 2);
      ctx.fill();
      if (item.label) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px Consolas, monospace';
        ctx.fillText(item.label, item.sx + 7, item.sy + 3);
      }
      ctx.restore();
    }
  }

  // Draw key 3D floating labels for Drums & Stack
  [
    { text: 'GT INLET ' + sim.tags.P1HNA91CT901.toFixed(0) + '°C', pos: [-22, 11.5, 0], col: '#fca5a5' },
    { text: 'HP DRUM ' + sim.tags.P1HAD91CP901.toFixed(0) + ' barA', pos: [-2.8, 22.8, 0], col: '#fde047' },
    { text: 'IP DRUM ' + sim.tags.P1HAD92CP901.toFixed(1) + ' barA', pos: [9.2, 22.0, 0], col: '#67e8f9' },
    { text: 'LP DRUM / DEA ' + sim.tags.P1HAD93CP901.toFixed(1) + ' barA', pos: [16.2, 25.0, 0], col: '#93c5fd' },
    { text: 'STACK ' + sim.tags.P1HNE91CT001.toFixed(1) + '°C', pos: [26.5, 42.5, 0], col: '#e2e8f0' }
  ].forEach(lb => {
    const p = project(lb.pos[0], lb.pos[1], lb.pos[2], w, h);
    if (!p) return;
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    const tw = ctx.measureText(lb.text).width;
    ctx.fillStyle = 'rgba(7, 13, 23, 0.78)';
    ctx.fillRect(p.sx - tw/2 - 5, p.sy - 12, tw + 10, 17);
    ctx.fillStyle = lb.col;
    ctx.fillText(lb.text, p.sx - tw/2, p.sy);
  });
}

// === MAIN SIMULATION & ANIMATION LOOP ===
renderZoneChips();
updateRightPanel();

let lastTick = performance.now();
let uiAcc = 0;

function loop(now) {
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;

  if (!paused) {
    sim.step(dt * 1.6); // slightly accelerated real-time for crisp training response
  }

  render3D();

  uiAcc += dt;
  if (uiAcc > 0.25) {
    uiAcc = 0;
    updateRightPanel();
    if (mainTab === 'dcs') updateDCSDynamic();
    if (mainTab === 'cfd') renderCFDTable();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(dir, 'HRSG_CFD_3D_Simulator.html'), html, 'utf8');
console.log('Generated HRSG_CFD_3D_Simulator.html (' + (html.length / 1024).toFixed(1) + ' KB)');
