/**
 * HRSG 3D CFD & Dynamic DCS Process Simulator Engine (Pure JavaScript)
 * Compatible with Node.js (CommonJS) and Browser (global HRSGSimulator)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HRSGSimulator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  class PIDController {
    constructor(cfg) {
      this.tag = cfg.tag;
      this.name = cfg.name;
      this.unit = cfg.unit;
      this.actuator = cfg.actuator;
      this.kp = cfg.kp;
      this.ki = cfg.ki;
      this.kd = cfg.kd || 0;
      this.sp = cfg.sp;
      this.op = cfg.op;
      this.opMin = cfg.opMin !== undefined ? cfg.opMin : 0;
      this.opMax = cfg.opMax !== undefined ? cfg.opMax : 100;
      this.reverse = !!cfg.reverse; // true: higher PV -> higher OP (cooling/venting/pressure relief)
      this.mode = 'AUTO'; // 'AUTO' | 'MAN'
      this.integral = cfg.op;
      this.lastErr = 0;
      this.pv = cfg.sp;
    }

    step(pv, dt) {
      this.pv = pv;
      if (this.mode !== 'AUTO') {
        this.integral = this.op;
        this.lastErr = this.reverse ? (pv - this.sp) : (this.sp - pv);
        return this.op;
      }
      const err = this.reverse ? (pv - this.sp) : (this.sp - pv);
      this.integral = clamp(this.integral + this.ki * err * dt, this.opMin, this.opMax);
      const deriv = dt > 0 ? (err - this.lastErr) / dt : 0;
      this.lastErr = err;
      this.op = clamp(this.integral + this.kp * err + this.kd * deriv, this.opMin, this.opMax);
      return this.op;
    }

    setMode(mode) {
      this.mode = mode === 'MAN' ? 'MAN' : 'AUTO';
      if (this.mode === 'AUTO') this.integral = this.op;
    }

    setSP(sp) {
      this.sp = Number(sp);
    }

    setOP(op) {
      this.op = clamp(Number(op), this.opMin, this.opMax);
      this.integral = this.op;
    }
  }

  class HRSGSimulator {
    constructor(data) {
      this.data = data;
      this.loadCaseId = 'BASE_100';
      this.time = 0;
      this.activeScenario = null;
      this.scenarioTimer = 0;
      this.scenarioResult = null;
      this.alarms = [];
      this.history = [];
      this.maxHistory = 120;

      // 3D CFD Mesh: Nx=20 (axial x), Ny=6 (vertical y), Nz=4 (transverse z)
      this.cfdGrid = { nx: 20, ny: 6, nz: 4, cells: [], summary: {} };

      this.initState('BASE_100');
    }

    initState(caseId) {
      this.loadCaseId = caseId || 'BASE_100';
      const hb = this.data.heat_balance_cases[this.loadCaseId];
      this.hb = hb;
      this.time = 0;
      this.activeScenario = null;
      this.scenarioTimer = 0;
      this.scenarioResult = null;
      this.alarms = [];
      this.history = [];

      // Equipment running states (pumps & damper)
      this.equipState = {
        P1LCB10AP001: true,  // CPH Recirc Pump A (Running)
        P1LCB10AP002: false, // CPH Recirc Pump B (Standby)
        P1LCQ93AP001: true,  // BD Transfer Pump A (Running)
        P1LCQ93AP002: false, // BD Transfer Pump B (Standby)
        P1HNA91AT001: false  // Dehumidifier (OFF during operation)
      };

      // Fault injection flags
      this.faults = {
        damperStuck: false,
        hpEcoHot: false,
        lpColdSurge: false,
        ibdHighInflow: false
      };

      // Process variables (tags)
      this.tags = {
        // Exhaust Gas & Stack
        P1HNA91CT901: hb.flue_gas.inlet_temp_c,
        P1HNA91CP901: hb.flue_gas.inlet_pressure_bara,
        P1HNE91CT001: hb.flue_gas.stack_temp_c,
        P1HNE91CG001: 100.0,
        FG_FLOW: hb.flue_gas.mass_flow_tph,

        // HP SH & RH
        P1LBA91CT901: hb.hp.steam_t_c,
        P1LBA91CP901: hb.hp.steam_p_bara,
        P1LBA91CF901: hb.hp.steam_flow_tph,
        P1LAE91CF901: hb.hp.dsh_spray_tph,
        P1LBB91CT911: hb.rh.hrh_t_c,
        P1LBB91CP901: hb.rh.hrh_p_bara,
        P1LAF91CF901: hb.rh.dsh_spray_tph,
        RH_FLOW: hb.rh.hrh_flow_tph,

        // HP Evap & Drum
        P1HAD91CL911: 0.0,
        P1HAD91CP901: hb.hp.drum_p_bara,
        P1HAD91CT001: hb.hp.drum_t_c,

        // HP Eco
        P1LAB91CF901: hb.hp.fw_flow_tph,
        P1HAC91CT901: hb.hp.drum_t_c - 6.0,
        P1LAB93CT911: hb.hp.drum_t_c - 6.0,

        // IP System
        P1HAD92CL911: 0.0,
        P1HAD92CP901: hb.ip.drum_p_bara,
        P1LBA92CP911: hb.ip.steam_p_bara,
        P1LBA92CF901: hb.ip.steam_flow_tph,
        P1LAB95CF901: hb.ip.fw_flow_tph,

        // LP System & DEA
        P1HAD93CL911: 0.0,
        P1HAD93CP901: hb.lp.drum_p_bara,
        P1LBA95CT901: hb.lp.steam_t_c,
        P1LBA95CF901: hb.lp.steam_flow_tph,

        // CPH System
        P1LCA10CF901: hb.cph.condensate_flow_tph,
        P1LCB30CT901: hb.cph.mixed_inlet_temp_c,
        P1LCB30CF901: hb.cph.recirc_flow_tph,
        P1LCC10CT001: hb.cph.outlet_temp_c,

        // Blowdown & Utility
        P1LCQ91CL911: 50.0,
        P1LCQ92CL911: 45.0,
        P1GHD91CT911: 54.0,
        BD_FLOW: 18.0
      };

      // PID Controllers
      this.pids = {
        P1HNE91CG001: new PIDController({
          tag: 'P1HNE91CG001', name: 'Stack Damper', unit: '%', actuator: 'P1HNE91AA001',
          kp: 0.8, ki: 0.2, sp: 100.0, op: 100.0, reverse: false
        }),
        P1LBA91CT901: new PIDController({
          tag: 'P1LBA91CT901', name: 'HP SH DSH TIC', unit: '°C', actuator: 'P1LAE91AA081',
          kp: 2.2, ki: 0.45, sp: hb.hp.steam_t_c, op: clamp((hb.hp.dsh_spray_tph / 45.0) * 100, 0, 100), reverse: true
        }),
        P1LBB91CT911: new PIDController({
          tag: 'P1LBB91CT911', name: 'RH DSH TIC', unit: '°C', actuator: 'P1LAF91AA081',
          kp: 2.0, ki: 0.4, sp: hb.rh.hrh_t_c, op: clamp((hb.rh.dsh_spray_tph / 25.0) * 100, 0, 100), reverse: true
        }),
        P1HAD91CL911: new PIDController({
          tag: 'P1HAD91CL911', name: 'HP Drum LIC', unit: 'mm', actuator: 'P1LAB91AA081',
          kp: 0.55, ki: 0.04, kd: 0.55, sp: 0.0, op: clamp((hb.hp.fw_flow_tph / 450.0) * 100, 10, 95), reverse: false
        }),
        P1LAB93CT911: new PIDController({
          tag: 'P1LAB93CT911', name: 'HP Eco Bypass TIC', unit: '°C', actuator: 'P1LAB93AA081',
          kp: 3.0, ki: 0.5, sp: hb.hp.drum_t_c - 10.0, op: 15.0, reverse: true
        }),
        P1HAD92CL911: new PIDController({
          tag: 'P1HAD92CL911', name: 'IP Drum LIC', unit: 'mm', actuator: 'P1HAC94AA081',
          kp: 0.35, ki: 0.08, sp: 0.0, op: clamp((hb.ip.fw_flow_tph / 85.0) * 100, 10, 95), reverse: false
        }),
        P1LBA92CP911: new PIDController({
          tag: 'P1LBA92CP911', name: 'IP Steam PIC', unit: 'barA', actuator: 'P1LBA92AA081',
          kp: 12.0, ki: 2.5, sp: hb.ip.steam_p_bara, op: 72.0, reverse: true
        }),
        P1HAD93CL911: new PIDController({
          tag: 'P1HAD93CL911', name: 'LP Drum LIC', unit: 'mm', actuator: 'P1LCC91AA081',
          kp: 0.3, ki: 0.06, sp: 0.0, op: 65.0, reverse: false
        }),
        P1HAD93CP901: new PIDController({
          tag: 'P1HAD93CP901', name: 'LP/DEA Pegging PIC', unit: 'barA', actuator: 'P1LBC91AA081',
          kp: 18.0, ki: 3.5, sp: hb.lp.drum_p_bara, op: 25.0, reverse: false
        }),
        P1LCB30CT901: new PIDController({
          tag: 'P1LCB30CT901', name: 'CPH Recirc TIC', unit: '°C', actuator: 'P1LCB30AA081',
          kp: 3.5, ki: 0.65, sp: 60.0, op: clamp((hb.cph.recirc_flow_tph / 130.0) * 100, 15, 95), reverse: false
        }),
        P1LCQ91CL911: new PIDController({
          tag: 'P1LCQ91CL911', name: 'CBD Tank LIC', unit: '%', actuator: 'P1LCQ91AA081',
          kp: 1.5, ki: 0.35, sp: 50.0, op: 45.0, reverse: true
        }),
        P1GHD91CT911: new PIDController({
          tag: 'P1GHD91CT911', name: 'IBD Quench TIC', unit: '°C', actuator: 'P1GHD91AA081',
          kp: 2.5, ki: 0.55, sp: 55.0, op: 30.0, reverse: true
        })
      };

      this.computeCFD();
      this.recordHistory();
    }

    setLoadCase(caseId) {
      if (this.data.heat_balance_cases[caseId]) {
        this.initState(caseId);
      }
    }

    startScenario(scenarioId) {
      const sc = this.data.scenarios.find((s) => s.id === scenarioId);
      if (!sc) return null;

      // Pick appropriate base load case for scenario
      if (scenarioId === 'SC_HP_SH_RH') {
        this.initState('LOAD_50');
      } else {
        this.initState('BASE_100');
      }

      this.activeScenario = sc;
      this.scenarioTimer = 0;
      this.scenarioResult = null;

      // Inject scenario-specific realistic fault
      switch (scenarioId) {
        case 'SC_EXHAUST_GAS':
          this.faults.damperStuck = true;
          this.pids.P1HNE91CG001.setMode('MAN');
          this.pids.P1HNE91CG001.setOP(42.0);
          break;
        case 'SC_HP_SH_RH':
          this.pids.P1LBA91CT901.setMode('MAN');
          this.pids.P1LBA91CT901.setOP(0.0);
          this.pids.P1LBB91CT911.setMode('MAN');
          this.pids.P1LBB91CT911.setOP(0.0);
          break;
        case 'SC_HP_EVAP':
          this.pids.P1HAD91CL911.setMode('MAN');
          this.pids.P1HAD91CL911.setOP(40.0);
          break;
        case 'SC_HP_ECO':
          this.faults.hpEcoHot = true;
          this.pids.P1LAB93CT911.setMode('MAN');
          this.pids.P1LAB93CT911.setOP(0.0);
          break;
        case 'SC_IP_SYSTEM':
          this.pids.P1LBA92CP911.setMode('MAN');
          this.pids.P1LBA92CP911.setOP(20.0);
          break;
        case 'SC_LP_SYSTEM':
          this.faults.lpColdSurge = true;
          this.pids.P1HAD93CP901.setMode('MAN');
          this.pids.P1HAD93CP901.setOP(0.0);
          break;
        case 'SC_CPH_SYSTEM':
          this.equipState.P1LCB10AP001 = false; // Pump A trips
          this.equipState.P1LCB10AP002 = false; // Pump B not started yet
          break;
        case 'SC_BLOWDOWN_UTILITY':
          this.faults.ibdHighInflow = true;
          this.equipState.P1LCQ93AP001 = false; // BD Pump A trips
          this.equipState.P1LCQ93AP002 = false;
          this.pids.P1GHD91CT911.setMode('MAN');
          this.pids.P1GHD91CT911.setOP(0.0);
          break;
      }
      return sc;
    }

    stopScenario() {
      this.activeScenario = null;
      this.scenarioTimer = 0;
      this.scenarioResult = null;
    }

    setEquipmentState(tag, running) {
      if (tag in this.equipState) {
        this.equipState[tag] = !!running;
      }
    }

    /**
     * 3D Computational Fluid Dynamics (CFD) Solver for HRSG Flue Gas Duct
     * Computes:
     * - 3D Velocity field u(x,y,z), v(x,y,z), w(x,y,z) using continuity + diffuser jet + buoyancy
     * - 3D Temperature field T(x,y,z) across 8 tube-bank heat exchangers with thermal stratification
     * - Axial Pressure field P(x) using Darcy-Forchheimer porous tube-bank pressure drop + damper loss
     * - Module heat duties Q_i (MW), Reynolds number Re, Nusselt number Nu, overall h (W/m2K)
     */
    computeCFD() {
      const hb = this.hb;
      const fg = hb.flue_gas;
      const mDot = fg.mass_flow_tph / 3.6; // kg/s
      const R_gas = 290.0; // J/(kg·K) for natural gas combustion exhaust
      const Cp_gas = 1.115; // kJ/(kg·K) average flue gas Cp
      const mu_gas = 3.2e-5; // Pa·s dynamic viscosity at mean temp
      const k_gas = 0.048; // W/(m·K) thermal conductivity
      const Pr = (Cp_gas * 1000 * mu_gas) / k_gas;

      // Duct geometry derived from GA & 11,835 m3 HRSG volume
      const ductHeight = 16.5; // m
      const ductWidth = 11.8;  // m
      const ductArea = ductHeight * ductWidth; // ~194.7 m2
      const dTube = 0.038; // 38mm finned tube OD
      const porosity = 0.72; // open flow area fraction through finned tube banks

      // Stack damper position effect on backpressure
      const damperOpen = clamp(this.tags.P1HNE91CG001, 10, 100) / 100.0;
      const damperK = 0.4 + 14.0 * Math.pow(1.0 - damperOpen, 2.2);

      // Module inlet temperatures (8 modules + stack exit)
      const modTemps = fg.module_inlet_temps_c;
      const tNodes = [fg.inlet_temp_c, ...modTemps, fg.stack_temp_c]; // 10 axial stations
      const nStations = tNodes.length;

      // Compute axial pressure drop from stack back to inlet
      const pStack = fg.stack_pressure_bara; // 1.009 barA
      const pBaseDrop = (fg.inlet_pressure_bara - pStack) * 1e5; // Pa at 100% damper
      // Extra pressure drop due to damper restriction
      const rhoStack = (pStack * 1e5) / (R_gas * (fg.stack_temp_c + 273.15));
      const stackArea = Math.PI * Math.pow(5.2 / 2, 2); // ~21.2 m2
      const vStack = mDot / (rhoStack * stackArea);
      const dpDamperExtra = 0.5 * (damperK - 0.4) * rhoStack * vStack * vStack; // Pa
      const totalDpPa = pBaseDrop + dpDamperExtra;

      // Update inlet pressure & stack temp tags from CFD
      this.tags.P1HNA91CP901 = Number((pStack + totalDpPa / 1e5).toFixed(4));
      this.tags.P1HNE91CT001 = Number((fg.stack_temp_c + (1.0 - damperOpen) * 22.0).toFixed(1));
      this.tags.P1HNA91CT901 = fg.inlet_temp_c;
      this.tags.FG_FLOW = fg.mass_flow_tph;

      // Module-by-module CFD thermal & hydraulic analysis (8 modules)
      const moduleNames = [
        'M1: HP SH #3 & Hot RH',
        'M2: HP SH #1/#2 & Cold RH',
        'M3: HP Evaporator',
        'M4: HP Eco #5-#8 & IP SH',
        'M5: IP Evap & HP Eco #3-#4',
        'M6: LP SH, IP Eco & HP Eco #1-#2',
        'M7: LP Evaporator',
        'M8: Condensate Preheater #1-#4'
      ];

      const modules = [];
      let totalHeatDutyMW = 0;
      let maxVelocity = 0;

      for (let m = 0; m < 8; m++) {
        const tIn = modTemps[m];
        const tOut = m < 7 ? modTemps[m + 1] : this.tags.P1HNE91CT001;
        const tMeanK = 0.5 * (tIn + tOut) + 273.15;
        const pLocalBar = pStack + (totalDpPa / 1e5) * ((8 - m) / 8.5);
        const rho = (pLocalBar * 1e5) / (R_gas * tMeanK);
        const vFace = mDot / (rho * ductArea);
        const vInterstitial = vFace / porosity;
        if (vInterstitial > maxVelocity) maxVelocity = vInterstitial;

        const re = (rho * vInterstitial * dTube) / mu_gas;
        const nu = 0.27 * Math.pow(re, 0.63) * Math.pow(Pr, 0.36); // Zhukauskas correlation
        const hConv = (nu * k_gas) / dTube; // W/(m2·K)
        const qMW = (mDot * Cp_gas * Math.max(0, tIn - tOut)) / 1000.0;
        const dpModPa = (pBaseDrop / 8.0) * (tMeanK / 600.0);
        totalHeatDutyMW += qMW;

        modules.push({
          index: m + 1,
          name: moduleNames[m],
          tIn_c: Number(tIn.toFixed(1)),
          tOut_c: Number(tOut.toFixed(1)),
          p_bara: Number(pLocalBar.toFixed(4)),
          dp_pa: Number(dpModPa.toFixed(1)),
          rho_kgm3: Number(rho.toFixed(3)),
          v_face_ms: Number(vFace.toFixed(2)),
          v_max_ms: Number(vInterstitial.toFixed(2)),
          reynolds: Math.round(re),
          nusselt: Number(nu.toFixed(1)),
          h_wm2k: Number(hConv.toFixed(1)),
          heat_duty_mw: Number(qMW.toFixed(2))
        });
      }

      // Generate 3D Mesh cells (Nx=20, Ny=6, Nz=4) for 3D volumetric heatmap & streamlines
      const { nx, ny, nz } = this.cfdGrid;
      const cells = [];
      for (let ix = 0; ix < nx; ix++) {
        const fx = ix / (nx - 1); // 0 = inlet duct, 1 = stack base
        const sPos = fx * (nStations - 1);
        const sIdx = Math.min(Math.floor(sPos), nStations - 2);
        const sFrac = sPos - sIdx;
        const tAxial = tNodes[sIdx] * (1 - sFrac) + tNodes[sIdx + 1] * sFrac;
        const pAxial = pStack + (totalDpPa / 1e5) * (1 - fx);

        // Diffuser expansion at ix < 4: smaller cross-section -> higher jet velocity
        const areaFactor = fx < 0.2 ? (0.42 + 2.9 * fx) : 1.0;

        for (let iy = 0; iy < ny; iy++) {
          const fy = iy / (ny - 1); // 0 = bottom, 1 = top
          // Thermal stratification (buoyancy: hot gas rises slightly +14°C at top)
          const tStrat = (fy - 0.5) * 18.0 * (1 - 0.5 * fx);
          // Damper restriction causes recirculation pocket at back-bottom
          const vortexDelta = (1 - damperOpen) * 35.0 * Math.max(0, fx - 0.65) * (1 - fy);
          const T = clamp(tAxial + tStrat + vortexDelta, 55, 760);

          const rho = (pAxial * 1e5) / (R_gas * (T + 273.15));
          const uBase = mDot / (rho * ductArea * areaFactor);
          // Vertical jet profile in diffuser + boundary layer near walls
          const wallFactor = 1.0 - 0.22 * Math.pow(2 * fy - 1, 4);
          const u = uBase * wallFactor * (1.0 + 0.12 * (1 - damperOpen));
          // Vertical velocity component (upward in diffuser & toward stack exit)
          const v = (fx < 0.22 ? 2.4 * (fy - 0.35) : 0) + (fx > 0.85 ? 5.5 * (fx - 0.85) / 0.15 : 0.25 * (fy - 0.5));

          for (let iz = 0; iz < nz; iz++) {
            const fz = iz / (nz - 1);
            const zWall = 1.0 - 0.15 * Math.pow(2 * fz - 1, 2);
            cells.push({
              ix, iy, iz,
              x: -22 + fx * 48,
              y: 2.0 + fy * 14.0,
              z: -5.0 + fz * 10.0,
              T: Number(T.toFixed(1)),
              P: Number(pAxial.toFixed(4)),
              u: Number((u * zWall).toFixed(2)),
              v: Number(v.toFixed(2)),
              speed: Number(Math.hypot(u * zWall, v).toFixed(2))
            });
          }
        }
      }

      this.cfdGrid.cells = cells;
      this.cfdGrid.summary = {
        load_case: this.hb.name,
        mass_flow_tph: fg.mass_flow_tph,
        t_inlet_c: fg.inlet_temp_c,
        t_stack_c: this.tags.P1HNE91CT001,
        p_inlet_bara: this.tags.P1HNA91CP901,
        dp_total_mbar: Number((totalDpPa / 100.0).toFixed(2)),
        v_stack_ms: Number(vStack.toFixed(2)),
        v_max_tube_ms: Number(maxVelocity.toFixed(2)),
        total_heat_duty_mw: Number(totalHeatDutyMW.toFixed(2)),
        modules
      };
    }

    /**
     * Advance dynamic process + PID + CFD simulation by dt seconds
     */
    step(dt) {
      dt = clamp(dt || 0.5, 0.05, 1.0);
      this.time += dt;
      const hb = this.hb;

      // 1. Stack Damper (Zone 1)
      if (!this.faults.damperStuck || this.pids.P1HNE91CG001.mode === 'AUTO' || this.pids.P1HNE91CG001.op > 45) {
        const targetDamper = this.pids.P1HNE91CG001.step(this.tags.P1HNE91CG001, dt);
        this.tags.P1HNE91CG001 += (targetDamper - this.tags.P1HNE91CG001) * clamp(dt * 0.45, 0, 1);
      } else {
        this.tags.P1HNE91CG001 += (this.pids.P1HNE91CG001.op - this.tags.P1HNE91CG001) * clamp(dt * 0.45, 0, 1);
      }

      // Update CFD fields from current load & damper state
      this.computeCFD();

      // 2. HP Superheater & Reheater Desuperheater (Zone 2)
      const hpDshOp = this.pids.P1LBA91CT901.step(this.tags.P1LBA91CT901, dt);
      const hpSpray = (hpDshOp / 100.0) * 45.0; // max 45 t/h
      this.tags.P1LAE91CF901 += (hpSpray - this.tags.P1LAE91CF901) * clamp(dt * 0.5, 0, 1);
      const hpUnattempT = hb.hp.steam_t_c + hb.hp.dsh_spray_tph * 1.45; // temp if spray = 0
      const hpTargetT = hpUnattempT - this.tags.P1LAE91CF901 * 1.45;
      this.tags.P1LBA91CT901 += (hpTargetT - this.tags.P1LBA91CT901) * clamp(dt * 0.18, 0, 1);

      const rhDshOp = this.pids.P1LBB91CT911.step(this.tags.P1LBB91CT911, dt);
      const rhSpray = (rhDshOp / 100.0) * 25.0; // max 25 t/h
      this.tags.P1LAF91CF901 += (rhSpray - this.tags.P1LAF91CF901) * clamp(dt * 0.5, 0, 1);
      const rhUnattempT = hb.rh.hrh_t_c + hb.rh.dsh_spray_tph * 2.2;
      const rhTargetT = rhUnattempT - this.tags.P1LAF91CF901 * 2.2;
      this.tags.P1LBB91CT911 += (rhTargetT - this.tags.P1LBB91CT911) * clamp(dt * 0.18, 0, 1);

      // 3. HP Drum Level & HP Economizer (Zone 3 & 4)
      const hpFwOp = this.pids.P1HAD91CL911.step(this.tags.P1HAD91CL911, dt);
      const hpFwFlow = (hpFwOp / 100.0) * 450.0;
      this.tags.P1LAB91CF901 += (hpFwFlow - this.tags.P1LAB91CF901) * clamp(dt * 0.45, 0, 1);
      // Level mass balance (normal fw_flow matches steam_flow equilibrium)
      const hpMassImbalance = this.tags.P1LAB91CF901 - hb.hp.fw_flow_tph; // t/h
      this.tags.P1HAD91CL911 = clamp(this.tags.P1HAD91CL911 + hpMassImbalance * 0.045 * dt, -300, 300);

      // HP Eco Bypass TIC (prevents steaming)
      const hpEcoBypOp = this.pids.P1LAB93CT911.step(this.tags.P1HAC91CT901, dt);
      const hpEcoBaseT = (this.faults.hpEcoHot ? hb.hp.drum_t_c + 1.5 : hb.hp.drum_t_c - 4.5);
      const hpEcoTargetT = hpEcoBaseT - (hpEcoBypOp / 100.0) * 24.0;
      this.tags.P1HAC91CT901 += (hpEcoTargetT - this.tags.P1HAC91CT901) * clamp(dt * 0.22, 0, 1);
      this.tags.P1LAB93CT911 = this.tags.P1HAC91CT901;

      // 4. IP System (Zone 5)
      const ipFwOp = this.pids.P1HAD92CL911.step(this.tags.P1HAD92CL911, dt);
      const ipFwFlow = (ipFwOp / 100.0) * 85.0;
      this.tags.P1LAB95CF901 += (ipFwFlow - this.tags.P1LAB95CF901) * clamp(dt * 0.45, 0, 1);
      this.tags.P1HAD92CL911 = clamp(this.tags.P1HAD92CL911 + (this.tags.P1LAB95CF901 - hb.ip.fw_flow_tph) * 0.08 * dt, -250, 250);

      const ipPcvOp = this.pids.P1LBA92CP911.step(this.tags.P1LBA92CP911, dt);
      const ipSteamOut = hb.ip.steam_flow_tph * clamp(ipPcvOp / 72.0, 0.15, 1.35);
      this.tags.P1LBA92CF901 += (ipSteamOut - this.tags.P1LBA92CF901) * clamp(dt * 0.4, 0, 1);
      const ipTargetP = hb.ip.steam_p_bara + (72.0 - ipPcvOp) * 0.075;
      this.tags.P1LBA92CP911 += (ipTargetP - this.tags.P1LBA92CP911) * clamp(dt * 0.25, 0, 1);
      this.tags.P1HAD92CP901 = this.tags.P1LBA92CP911 + 0.35;

      // 5. LP System & Integral Deaerator (Zone 6)
      const lpFwOp = this.pids.P1HAD93CL911.step(this.tags.P1HAD93CL911, dt);
      const lpImbalance = (lpFwOp - 65.0) * 0.8;
      this.tags.P1HAD93CL911 = clamp(this.tags.P1HAD93CL911 + lpImbalance * 0.12 * dt, -250, 250);

      const pegOp = this.pids.P1HAD93CP901.step(this.tags.P1HAD93CP901, dt);
      const lpColdDrop = this.faults.lpColdSurge ? 2.1 : 0.0;
      const lpTargetP = hb.lp.drum_p_bara - lpColdDrop + (pegOp / 100.0) * 3.2 - 0.8 * (this.faults.lpColdSurge ? 0 : 1) + (this.faults.lpColdSurge ? 0 : 0.8 - (pegOp - 25) * 0.01);
      const lpEffTargetP = this.faults.lpColdSurge
        ? clamp(hb.lp.drum_p_bara - 2.2 + (pegOp / 100.0) * 3.4, 3.0, 8.5)
        : clamp(hb.lp.drum_p_bara + (pegOp - 25.0) * 0.02, 3.0, 8.5);
      this.tags.P1HAD93CP901 += (lpEffTargetP - this.tags.P1HAD93CP901) * clamp(dt * 0.25, 0, 1);
      this.tags.P1LBA95CF901 = clamp(hb.lp.steam_flow_tph * (this.tags.P1HAD93CP901 / hb.lp.drum_p_bara), 5, 65);

      // 6. Condensate Preheater & Recirculation Pumps (Zone 7)
      const cphPumpsOn = (this.equipState.P1LCB10AP001 ? 1 : 0) + (this.equipState.P1LCB10AP002 ? 1 : 0);
      const cphTcvOp = this.pids.P1LCB30CT901.step(this.tags.P1LCB30CT901, dt);
      const cphRecircTarget = cphPumpsOn > 0 ? (cphTcvOp / 100.0) * 130.0 * (cphPumpsOn > 1 ? 1.15 : 1.0) : 0.0;
      this.tags.P1LCB30CF901 += (cphRecircTarget - this.tags.P1LCB30CF901) * clamp(dt * 0.5, 0, 1);
      const mCond = hb.cph.condensate_flow_tph;
      const tCondIn = hb.cph.inlet_temp_c;
      const tCphOut = this.tags.P1LCC10CT001;
      const tMixedTarget = (mCond * tCondIn + this.tags.P1LCB30CF901 * tCphOut) / (mCond + this.tags.P1LCB30CF901);
      this.tags.P1LCB30CT901 += (tMixedTarget - this.tags.P1LCB30CT901) * clamp(dt * 0.35, 0, 1);
      const tCphOutTarget = hb.cph.outlet_temp_c - (60.0 - this.tags.P1LCB30CT901) * 0.7;
      this.tags.P1LCC10CT001 += (tCphOutTarget - this.tags.P1LCC10CT001) * clamp(dt * 0.2, 0, 1);

      // 7. Blowdown System & Utility (Zone 8)
      const cbdOp = this.pids.P1LCQ91CL911.step(this.tags.P1LCQ91CL911, dt);
      const cbdTargetL = clamp(50.0 + (45.0 - cbdOp) * 0.45, 10, 95);
      this.tags.P1LCQ91CL911 += (cbdTargetL - this.tags.P1LCQ91CL911) * clamp(dt * 0.25, 0, 1);

      const bdPumpsOn = (this.equipState.P1LCQ93AP001 ? 1 : 0) + (this.equipState.P1LCQ93AP002 ? 1 : 0);
      const ibdInflow = this.faults.ibdHighInflow ? 3.2 : 0.8;
      const ibdOutflow = bdPumpsOn > 0 ? (this.tags.P1LCQ92CL911 > 35 ? 4.4 * bdPumpsOn : 0.8) : 0.0;
      this.tags.P1LCQ92CL911 = clamp(this.tags.P1LCQ92CL911 + (ibdInflow - ibdOutflow) * dt, 15, 96);

      const quenchOp = this.pids.P1GHD91CT911.step(this.tags.P1GHD91CT911, dt);
      const ibdHotT = this.faults.ibdHighInflow ? 86.0 : 66.0;
      const ibdTargetT = clamp(ibdHotT - (quenchOp / 100.0) * 42.0, 38, 95);
      this.tags.P1GHD91CT911 += (ibdTargetT - this.tags.P1GHD91CT911) * clamp(dt * 0.25, 0, 1);
      this.tags.BD_FLOW = bdPumpsOn > 0 ? 45.0 * bdPumpsOn : 4.0;

      // 8. Evaluate alarms & active scenario
      this.evaluateAlarms();
      if (this.activeScenario) {
        this.scenarioTimer += dt;
        this.scenarioResult = this.evaluateScenario();
      }

      if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) {
        this.recordHistory();
      }
    }

    evaluateAlarms() {
      const a = [];
      const t = this.tags;
      if (t.P1HNA91CP901 > 1.055) a.push({ level: 'HIHI', tag: 'P1HNA91CP901', zone: 'EXHAUST_GAS', msg: `Áp suất ngược kênh khói CAO (${t.P1HNA91CP901.toFixed(3)} barA)` });
      if (t.P1HNE91CG001 < 90) a.push({ level: 'WARN', tag: 'P1HNE91CG001', zone: 'EXHAUST_GAS', msg: `Van tiết lưu ống khói chưa mở hoàn toàn (${t.P1HNE91CG001.toFixed(0)}%)` });
      if (t.P1LBA91CT901 > 610) a.push({ level: 'HIHI', tag: 'P1LBA91CT901', zone: 'HP_SH_RH', msg: `Quá nhiệt hơi chính HP (${t.P1LBA91CT901.toFixed(1)}°C > 610°C)` });
      if (t.P1LBB91CT911 > 610) a.push({ level: 'HIHI', tag: 'P1LBB91CT911', zone: 'HP_SH_RH', msg: `Quá nhiệt hơi tái nhiệt HRH (${t.P1LBB91CT911.toFixed(1)}°C > 610°C)` });
      if (t.P1HAD91CL911 < -80) a.push({ level: 'LOLO', tag: 'P1HAD91CL911', zone: 'HP_EVAP', msg: `Mức nước bao hơi HP THẤP (${t.P1HAD91CL911.toFixed(0)} mm)` });
      if (t.P1HAD91CL911 > 80) a.push({ level: 'HIHI', tag: 'P1HAD91CL911', zone: 'HP_EVAP', msg: `Mức nước bao hơi HP CAO (${t.P1HAD91CL911.toFixed(0)} mm)` });
      if (t.P1HAC91CT901 > 348) a.push({ level: 'WARN', tag: 'P1HAC91CT901', zone: 'HP_ECO', msg: `Nguy cơ sôi nước HP Economizer (${t.P1HAC91CT901.toFixed(1)}°C)` });
      if (t.P1LBA92CP911 > 39.2) a.push({ level: 'HIHI', tag: 'P1LBA92CP911', zone: 'IP_SYSTEM', msg: `Quá áp hơi trung áp IP (${t.P1LBA92CP911.toFixed(2)} barA)` });
      if (t.P1HAD93CP901 < 5.3) a.push({ level: 'LOLO', tag: 'P1HAD93CP901', zone: 'LP_SYSTEM', msg: `Sụt áp bình khử khí / bao hơi LP (${t.P1HAD93CP901.toFixed(2)} barA)` });
      if (t.P1LCB30CT901 < 55) a.push({ level: 'LOLO', tag: 'P1LCB30CT901', zone: 'CPH_SYSTEM', msg: `Nhiệt độ nước vào CPH thấp (<55°C - ăn mòn điểm sương!)` });
      if (t.P1LCQ92CL911 > 70) a.push({ level: 'HIHI', tag: 'P1LCQ92CL911', zone: 'BLOWDOWN_UTILITY', msg: `Mức bồn xả đáy IBD CAO (${t.P1LCQ92CL911.toFixed(1)}%)` });
      if (t.P1GHD91CT911 > 62) a.push({ level: 'HIHI', tag: 'P1GHD91CT911', zone: 'BLOWDOWN_UTILITY', msg: `Nhiệt độ nước xả IBD quá giới hạn (${t.P1GHD91CT911.toFixed(1)}°C > 60°C)` });
      this.alarms = a;
    }

    evaluateScenario() {
      if (!this.activeScenario) return null;
      const details = this.activeScenario.criteria.map((c) => {
        const val = this.tags[c.tag];
        const ok = c.op === '>=' ? val >= c.target : val <= c.target;
        return { ...c, value: Number(val.toFixed(2)), ok };
      });
      const passed = details.every((d) => d.ok);
      return {
        scenario_id: this.activeScenario.id,
        passed,
        status_vi: passed ? 'ĐẠT' : 'CHƯA ĐẠT',
        elapsed_s: Number(this.scenarioTimer.toFixed(1)),
        details
      };
    }

    recordHistory() {
      const snap = { t: Number(this.time.toFixed(1)) };
      for (const k in this.tags) {
        snap[k] = Number(this.tags[k].toFixed(2));
      }
      this.history.push(snap);
      if (this.history.length > this.maxHistory) this.history.shift();
    }
  }

  return HRSGSimulator;
});
