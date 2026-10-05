import type { Params, Tech } from "./fields";

/**
 * Deterministic cash-flow model. Pure functions only; no randomness, no I/O, no AI.
 * All money is in the user's chosen currency. Year 0 is the purchase date; years
 * 1..H are operating years with cash flows at year end.
 */

export interface TechSpec {
  tech: Tech;
  price: number;
  maintPerKm: number;
  fixedAnnual: number;
  lifetime: number;
  residualPct: number;
  payloadKg: number;
  infraTotal: number;
  infraVehicles: number;
}

export function specOf(p: Params, tech: Tech): TechSpec {
  switch (tech) {
    case "diesel":
      return { tech, price: p.dPrice, maintPerKm: p.dMaintPerKm, fixedAnnual: p.dFixedAnnual, lifetime: p.dLifetime, residualPct: p.dResidualPct, payloadKg: p.dPayloadKg, infraTotal: 0, infraVehicles: 1 };
    case "bev":
      return { tech, price: p.bPrice, maintPerKm: p.bMaintPerKm, fixedAnnual: p.bFixedAnnual, lifetime: p.bLifetime, residualPct: p.bResidualPct, payloadKg: p.bPayloadKg, infraTotal: p.bInfraCost, infraVehicles: Math.max(1, p.bInfraVehicles) };
    case "biofuel":
      return { tech, price: p.fPrice, maintPerKm: p.fMaintPerKm, fixedAnnual: p.fFixedAnnual, lifetime: p.fLifetime, residualPct: p.fResidualPct, payloadKg: p.fPayloadKg, infraTotal: p.fInfraCost, infraVehicles: Math.max(1, p.fInfraVehicles) };
  }
}

export const annualKm = (p: Params) => p.dailyDistanceKm * p.operatingDays;

/** Quantity of energy bought per year, and its unit price in year t (t >= 1). */
export function energyUse(p: Params, tech: Tech) {
  const km = annualKm(p);
  switch (tech) {
    case "diesel":
      return { dieselL: (km * p.dConsumption) / 100, biofuelL: 0, kWh: 0 };
    case "bev":
      return { dieselL: 0, biofuelL: 0, kWh: (km * p.bConsumption * (1 + p.bChargingLossPct / 100)) / 100 };
    case "biofuel": {
      const litres = (km * p.dConsumption * (1 + p.fConsumptionPenaltyPct / 100)) / 100;
      const share = p.fBlendPct / 100;
      return { dieselL: litres * (1 - share), biofuelL: litres * share, kWh: 0 };
    }
  }
}

const esc = (pct: number, t: number) => Math.pow(1 + pct / 100, t - 1);

export function energyCostInYear(p: Params, tech: Tech, t: number): number {
  const u = energyUse(p, tech);
  return (
    u.dieselL * p.dieselPrice * esc(p.dieselEscPct, t) +
    u.biofuelL * p.biofuelPrice * esc(p.biofuelEscPct, t) +
    u.kWh * p.electricityPrice * esc(p.electricityEscPct, t)
  );
}

export function maintenanceCostInYear(p: Params, tech: Tech, t: number): number {
  const s = specOf(p, tech);
  return (annualKm(p) * s.maintPerKm + s.fixedAnnual) * esc(p.opexEscPct, t);
}

export function residualValue(p: Params, tech: Tech): number {
  const s = specOf(p, tech);
  const frac = 1 - (1 - s.residualPct / 100) * (p.horizonYears / s.lifetime);
  return s.price * frac;
}

export interface LoanYear { payment: number; interest: number; principal: number; balanceEnd: number }

/** Equal annual payments. Balance still owed after the horizon is settled in the final year. */
export function loanSchedule(p: Params, tech: Tech): LoanYear[] {
  const s = specOf(p, tech);
  const H = p.horizonYears;
  const principal = (s.price * p.financedSharePct) / 100;
  const out: LoanYear[] = [];
  if (principal <= 0 || p.loanTermYears <= 0) {
    for (let t = 1; t <= H; t++) out.push({ payment: 0, interest: 0, principal: 0, balanceEnd: 0 });
    return out;
  }
  const r = p.interestRatePct / 100;
  const n = p.loanTermYears;
  const annuity = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  let bal = principal;
  for (let t = 1; t <= H; t++) {
    const interest = bal * r;
    let pay = t <= n ? annuity : 0;
    let prin = Math.max(0, pay - interest);
    if (t === H && bal - prin > 1e-9) {
      // settle what is still owed at the end of the horizon
      prin = bal;
      pay = bal + interest;
    }
    bal = Math.max(0, bal - prin);
    out.push({ payment: pay, interest, principal: prin, balanceEnd: bal });
  }
  return out;
}

export interface TechResult {
  tech: Tech;
  spec: TechSpec;
  /** Cash outflow (positive = money spent) for years 0..H, residual shown separately. */
  yearly: {
    year: number;
    upfront: number; // equity paid at year 0
    energy: number;
    maintenance: number;
    battery: number;
    loanPayment: number;
    interest: number;
    residual: number;
    /** Net cash cost = upfront + energy + maintenance + battery + loanPayment - residual. */
    netCost: number;
  }[];
  breakdown: {
    acquisition: number;
    infrastructure: number;
    energy: number;
    maintenance: number;
    batteryReplacement: number;
    financingInterest: number;
    residualCredit: number;
  };
  tco: number; // nominal total cost of ownership over the horizon
  pvTco: number; // discounted at the discount rate
  costPerKm: number; // nominal TCO / total km
  levelisedCostPerKm: number; // PV TCO / discounted km
  costPerTonneKm: number | null;
  annualEnergyCostYear1: number;
  annualOperatingCostYear1: number; // energy + maintenance + fixed, excluding financing
  energyUse: ReturnType<typeof energyUse>;
  annualEmissionsKg: number;
  totalEmissionsKg: number;
  emissionsGPerKm: number;
}

export function emissionsPerYear(p: Params, tech: Tech): number {
  const u = energyUse(p, tech);
  return u.dieselL * p.efDiesel + u.biofuelL * p.efBiofuel + u.kWh * p.efGrid;
}

export function computeTech(p: Params, tech: Tech): TechResult {
  const s = specOf(p, tech);
  const H = p.horizonYears;
  const d = p.discountRatePct / 100;
  const km = annualKm(p);
  const loan = loanSchedule(p, tech);
  const infraPerVehicle = s.infraTotal / s.infraVehicles;
  const equity = s.price * (1 - p.financedSharePct / 100) + infraPerVehicle;
  const resid = residualValue(p, tech);
  const replYear = tech === "bev" && p.bBatteryReplCost > 0 ? p.bBatteryReplYear : 0;

  const yearly: TechResult["yearly"] = [];
  yearly.push({ year: 0, upfront: equity, energy: 0, maintenance: 0, battery: 0, loanPayment: 0, interest: 0, residual: 0, netCost: equity });
  let pv = equity;
  let totalEnergy = 0, totalMaint = 0, totalBattery = 0, totalInterest = 0;
  let discKm = 0;
  for (let t = 1; t <= H; t++) {
    const energy = energyCostInYear(p, tech, t);
    const maintenance = maintenanceCostInYear(p, tech, t);
    const battery = replYear === t ? p.bBatteryReplCost : 0;
    const l = loan[t - 1];
    const residual = t === H ? resid : 0;
    const netCost = energy + maintenance + battery + l.payment - residual;
    yearly.push({ year: t, upfront: 0, energy, maintenance, battery, loanPayment: l.payment, interest: l.interest, residual, netCost });
    const df = Math.pow(1 + d, -t);
    pv += netCost * df;
    discKm += km * df;
    totalEnergy += energy; totalMaint += maintenance; totalBattery += battery; totalInterest += l.interest;
  }

  const breakdown = {
    acquisition: s.price,
    infrastructure: infraPerVehicle,
    energy: totalEnergy,
    maintenance: totalMaint,
    batteryReplacement: totalBattery,
    financingInterest: totalInterest,
    residualCredit: -resid,
  };
  const tco = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const tonneKmPerYear = (km * s.payloadKg * (p.loadFactorPct / 100)) / 1000;
  const annualEmissionsKg = emissionsPerYear(p, tech);

  return {
    tech, spec: s, yearly, breakdown, tco, pvTco: pv,
    costPerKm: tco / (km * H),
    levelisedCostPerKm: pv / discKm,
    costPerTonneKm: tonneKmPerYear > 0 ? tco / (tonneKmPerYear * H) : null,
    annualEnergyCostYear1: energyCostInYear(p, tech, 1),
    annualOperatingCostYear1: energyCostInYear(p, tech, 1) + maintenanceCostInYear(p, tech, 1),
    energyUse: energyUse(p, tech),
    annualEmissionsKg,
    totalEmissionsKg: annualEmissionsKg * H,
    emissionsGPerKm: (annualEmissionsKg / km) * 1000,
  };
}

export interface Incremental {
  tech: Tech;
  /** Savings versus diesel per year, 0..H (positive = alternative is cheaper in that year). */
  savings: number[];
  cumulative: number[];
  npv: number;
  /** Years, interpolated. 0 = no extra outlay. null = not reached within the horizon. */
  paybackYears: number | null;
  discountedPaybackYears: number | null;
  annualSavingsYear1: number; // operating savings only (energy + maintenance + fixed)
  avgAnnualSavings: number; // total net savings over the horizon / H
  cumulativeSavings: number; // undiscounted, end of horizon
  emissionsReductionKg: number; // total over the horizon; negative = more emissions than diesel
  emissionsReductionPct: number;
  /** PV cost per tonne CO2e avoided: positive = costs money, negative = saves money. null if no CO2 saved. */
  abatementCostPerTonne: number | null;
}

function paybackOf(flows: number[]): number | null {
  let cum = 0;
  for (let t = 0; t < flows.length; t++) {
    const prev = cum;
    cum += flows[t];
    if (cum >= 0) {
      if (t === 0) return 0;
      // interpolate within year t: prev < 0, flow[t] > 0
      return t - 1 + -prev / flows[t];
    }
  }
  return null;
}

export function incremental(p: Params, base: TechResult, alt: TechResult): Incremental {
  const H = p.horizonYears;
  const d = p.discountRatePct / 100;
  const savings = base.yearly.map((y, i) => y.netCost - alt.yearly[i].netCost);
  const cumulative: number[] = [];
  let c = 0;
  for (const s of savings) { c += s; cumulative.push(c); }
  let npv = 0;
  const discounted = savings.map((s, t) => { const v = s * Math.pow(1 + d, -t); npv += v; return v; });
  const baseOp = base.annualOperatingCostYear1;
  const altOp = alt.annualOperatingCostYear1;
  const redKg = base.totalEmissionsKg - alt.totalEmissionsKg;
  return {
    tech: alt.tech,
    savings, cumulative, npv,
    paybackYears: paybackOf(savings),
    discountedPaybackYears: paybackOf(discounted),
    annualSavingsYear1: baseOp - altOp,
    avgAnnualSavings: cumulative[H] / H,
    cumulativeSavings: cumulative[H],
    emissionsReductionKg: redKg,
    emissionsReductionPct: base.totalEmissionsKg > 0 ? (redKg / base.totalEmissionsKg) * 100 : 0,
    abatementCostPerTonne: redKg > 0 ? (alt.pvTco - base.pvTco) / (redKg / 1000) : null,
  };
}
