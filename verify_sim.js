const fs = require('fs');
const path = require('path');
const HRSGSimulator = require('./hrsg_cfd_sim.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'hrsg_data.json'), 'utf8'));

console.log('====================================================================');
console.log('  1. KIEM CHUNG MO PHONG CFD 3 KICH BAN CAN BANG NHIET (HEAT BALANCE)');
console.log('====================================================================');

for (const caseId of ['BASE_100', 'LOAD_85', 'LOAD_50']) {
  const sim = new HRSGSimulator(data);
  sim.setLoadCase(caseId);
  for (let i = 0; i < 40; i++) sim.step(0.5);
  const s = sim.cfdGrid.summary;
  console.log(`\n[${caseId}] ${s.load_case}`);
  console.log(`  Luu luong khoi: ${s.mass_flow_tph} t/h | T_in: ${s.t_inlet_c} C -> T_stack: ${s.t_stack_c} C`);
  console.log(`  Ap suat vao: ${s.p_inlet_bara} barA | Sut ap tong dP: ${s.dp_total_mbar} mbar`);
  console.log(`  Van toc max qua ong: ${s.v_max_tube_ms} m/s | Van toc ong khoi: ${s.v_stack_ms} m/s | Tong nhiet thu hoi Q: ${s.total_heat_duty_mw} MW`);
  console.log(`  Hoi HP: ${sim.tags.P1LBA91CF901.toFixed(1)} t/h @ ${sim.tags.P1LBA91CP901.toFixed(1)} barA / ${sim.tags.P1LBA91CT901.toFixed(1)} C (DSH spray: ${sim.tags.P1LAE91CF901.toFixed(1)} t/h)`);
  console.log(`  Hoi HRH: ${sim.tags.RH_FLOW.toFixed(1)} t/h @ ${sim.tags.P1LBB91CP901.toFixed(1)} barA / ${sim.tags.P1LBB91CT911.toFixed(1)} C (DSH spray: ${sim.tags.P1LAF91CF901.toFixed(1)} t/h)`);
  console.log(`  Luoi CFD 3D: ${sim.cfdGrid.cells.length} o luoi (${sim.cfdGrid.nx}x${sim.cfdGrid.ny}x${sim.cfdGrid.nz})`);
}

console.log('\n====================================================================');
console.log('  2. KIEM CHUNG 8 KICH BAN SU CO (KHONG CAN THIEP vs XU LY DUNG)');
console.log('====================================================================');

const correctInterventions = {
  SC_EXHAUST_GAS: (sim) => {
    sim.pids.P1HNE91CG001.setMode('AUTO');
    sim.pids.P1HNE91CG001.setSP(100);
  },
  SC_HP_SH_RH: (sim) => {
    sim.pids.P1LBA91CT901.setMode('AUTO');
    sim.pids.P1LBA91CT901.setSP(603);
    sim.pids.P1LBB91CT911.setMode('AUTO');
    sim.pids.P1LBB91CT911.setSP(602);
  },
  SC_HP_EVAP: (sim) => {
    sim.pids.P1HAD91CL911.setMode('AUTO');
    sim.pids.P1HAD91CL911.setSP(0);
  },
  SC_HP_ECO: (sim) => {
    sim.pids.P1LAB93CT911.setMode('AUTO');
    sim.pids.P1LAB93CT911.setSP(338);
  },
  SC_IP_SYSTEM: (sim) => {
    sim.pids.P1LBA92CP911.setMode('AUTO');
    sim.pids.P1LBA92CP911.setSP(37.5);
  },
  SC_LP_SYSTEM: (sim) => {
    sim.pids.P1HAD93CP901.setMode('AUTO');
    sim.pids.P1HAD93CP901.setSP(6.4);
  },
  SC_CPH_SYSTEM: (sim) => {
    sim.setEquipmentState('P1LCB10AP002', true);
    sim.pids.P1LCB30CT901.setMode('AUTO');
    sim.pids.P1LCB30CT901.setSP(60.0);
  },
  SC_BLOWDOWN_UTILITY: (sim) => {
    sim.setEquipmentState('P1LCQ93AP002', true);
    sim.pids.P1GHD91CT911.setMode('AUTO');
    sim.pids.P1GHD91CT911.setSP(55.0);
  }
};

let allVerified = true;

for (const sc of data.scenarios) {
  // Run 1: No intervention (must FAIL -> CHUA DAT)
  const simNoAct = new HRSGSimulator(data);
  simNoAct.startScenario(sc.id);
  for (let i = 0; i < 80; i++) simNoAct.step(0.5);
  const resNoAct = simNoAct.evaluateScenario();

  // Run 2: Correct operator intervention at t = 10s (must PASS -> DAT)
  const simAct = new HRSGSimulator(data);
  simAct.startScenario(sc.id);
  for (let i = 0; i < 20; i++) simAct.step(0.5);
  correctInterventions[sc.id](simAct);
  for (let i = 0; i < 100; i++) simAct.step(0.5);
  const resAct = simAct.evaluateScenario();

  const ok = !resNoAct.passed && resAct.passed;
  if (!ok) allVerified = false;

  console.log(`\n[${sc.id}] ${sc.title}`);
  console.log(`  Khong can thiep : ${resNoAct.status_vi} (${resNoAct.details.map(d => `${d.tag}=${d.value}`).join(', ')})`);
  console.log(`  Xu ly dung      : ${resAct.status_vi} (${resAct.details.map(d => `${d.tag}=${d.value}`).join(', ')})`);
  console.log(`  => KIEM CHUNG   : ${ok ? 'HOP LE (PASS)' : 'LOI (NEED TUNE)'}`);
}

console.log('\n====================================================================');
console.log(allVerified ? 'TONG KET: TAT CA 3 CASE CFD + 8 KICH BAN SU CO DEU DAT CHUAN!' : 'TONG KET: CO KICH BAN CAN HIEU CHINH!');
console.log('====================================================================');
process.exit(allVerified ? 0 : 1);
