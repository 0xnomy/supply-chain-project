/**
 * Scenario Engine — Computes financial impact of interventions
 * against the baseline simulation data.
 */

import { getSimulationData } from './dataEngine';
import type {
  ScenarioConfig,
  ScenarioResult,
  InterventionImpact,
  MonthlyProjection,
  YearlyROI,
} from './types';

export const DEFAULT_SCENARIO: ScenarioConfig = {
  prePositioningSafetyDays: 7,
  fifoEnforced: false,
  consumptionBasedReorder: false,
  emergencyFrameworkEnabled: false,
  advanceBudgetRequest: false,
};

export function computeScenario(config: ScenarioConfig): ScenarioResult {
  const sim = getSimulationData();
  const fy = sim.fiscalYears;

  // Baseline annual averages (across 3 FYs)
  const baselineAnnualExpiry = fy.reduce((s, f) => s + f.expiryWasteRs, 0) / 3;
  const baselineAnnualStockoutRate = fy.reduce((s, f) => s + f.criticalStockoutRate, 0) / 3;
  const baselineAnnualPatientOOP = fy.reduce((s, f) => s + f.patientOOPRs, 0) / 3;
  const baselineAnnualEmergencyPremium = fy.reduce((s, f) => s + f.emergencyPremiumRs, 0) / 3;
  const baselineAnnualDelayedSurgery = fy.reduce((s, f) => s + f.delayedSurgeryCostRs, 0) / 3;

  const baseline = {
    annualExpiryWasteRs: baselineAnnualExpiry,
    annualStockoutRate: baselineAnnualStockoutRate,
    annualPatientOOPRs: baselineAnnualPatientOOP,
    annualEmergencyPremiumRs: baselineAnnualEmergencyPremium,
    annualDelayedSurgeryRs: baselineAnnualDelayedSurgery,
  };

  const interventions: InterventionImpact[] = [];

  // ── INTERVENTION 1: Pre-positioning Protocol ──
  const prePositioningEnabled = config.prePositioningSafetyDays > 7;
  const avgBlackoutDays = (81 + 69 + 86) / 3;
  const prePositioningEffectiveness = prePositioningEnabled
    ? Math.min(0.95, (config.prePositioningSafetyDays / avgBlackoutDays) * 0.80)
    : 0;
  const prePositioningStockoutReduction = prePositioningEffectiveness * 100;
  const prePositioningExpirySavings = prePositioningEnabled
    ? baselineAnnualExpiry * 0.08 : 0; // slight increase risk from more stock, but net positive
  const prePositioningOOPSavings = prePositioningEnabled
    ? baselineAnnualPatientOOP * prePositioningEffectiveness * 0.7 : 0;
  const prePositioningEmergencySavings = prePositioningEnabled
    ? baselineAnnualEmergencyPremium * prePositioningEffectiveness * 0.8 : 0;

  interventions.push({
    name: 'Pre-Positioning Protocol',
    description: `Safety stock of ${config.prePositioningSafetyDays} days for critical items before blackout periods. Pre-positions stock in April-June to bridge the Q1 budget blackout.`,
    annualExpirySavingsRs: -prePositioningExpirySavings, // negative = slight cost
    annualStockoutReductionPct: prePositioningStockoutReduction,
    annualPatientOOPSavingsRs: prePositioningOOPSavings,
    annualEmergencyPremiumSavingsRs: prePositioningEmergencySavings,
    implementationCostRs: prePositioningEnabled ? 12_000_000 : 0,
    ongoingOpexRs: prePositioningEnabled ? 2_400_000 : 0,
    totalAnnualSavingsRs: prePositioningOOPSavings + prePositioningEmergencySavings - prePositioningExpirySavings,
    paybackMonths: 0,
    enabled: prePositioningEnabled,
  });

  // ── INTERVENTION 2: FIFO Enforcement (RFID) ──
  const fifoExpirySavings = config.fifoEnforced
    ? baselineAnnualExpiry * 0.60 : 0; // 55-65% reduction → use 60%
  const fifoStockoutReduction = config.fifoEnforced ? 8 : 0; // slight improvement

  interventions.push({
    name: 'FIFO Enforcement (RFID)',
    description: 'RFID shelf tagging enforces strict FIFO picking. Oldest batch consumed first, eliminating the LIFO bias that causes rear-shelf expiry.',
    annualExpirySavingsRs: fifoExpirySavings,
    annualStockoutReductionPct: fifoStockoutReduction,
    annualPatientOOPSavingsRs: 0,
    annualEmergencyPremiumSavingsRs: 0,
    implementationCostRs: config.fifoEnforced ? 3_800_000 : 0,
    ongoingOpexRs: config.fifoEnforced ? 900_000 : 0,
    totalAnnualSavingsRs: fifoExpirySavings,
    paybackMonths: 0,
    enabled: config.fifoEnforced,
  });

  // ── INTERVENTION 3: Consumption-Based Reorder ──
  const consumptionExpirySavings = config.consumptionBasedReorder
    ? baselineAnnualExpiry * 0.35 : 0; // 35% reduction from better ordering
  const consumptionStockoutReduction = config.consumptionBasedReorder ? 15 : 0;
  const consumptionOOPSavings = config.consumptionBasedReorder
    ? baselineAnnualPatientOOP * 0.20 : 0;

  interventions.push({
    name: 'Consumption-Based Reorder',
    description: 'Replaces pharmacist manual forecasts (MAPE ~40%) with 14-day moving average consumption data (MAPE ~11%). Reduces both over-ordering and under-ordering.',
    annualExpirySavingsRs: consumptionExpirySavings,
    annualStockoutReductionPct: consumptionStockoutReduction,
    annualPatientOOPSavingsRs: consumptionOOPSavings,
    annualEmergencyPremiumSavingsRs: 0,
    implementationCostRs: config.consumptionBasedReorder ? 2_100_000 : 0,
    ongoingOpexRs: config.consumptionBasedReorder ? 600_000 : 0,
    totalAnnualSavingsRs: consumptionExpirySavings + consumptionOOPSavings,
    paybackMonths: 0,
    enabled: config.consumptionBasedReorder,
  });

  // ── INTERVENTION 4: Emergency Framework ──
  const emergencyStockoutReduction = config.emergencyFrameworkEnabled ? 65 : 0;
  const emergencyPremiumSavings = config.emergencyFrameworkEnabled
    ? baselineAnnualEmergencyPremium * 0.58 : 0; // reduces premium from 30% to 12%
  const emergencyOOPSavings = config.emergencyFrameworkEnabled
    ? baselineAnnualPatientOOP * 0.45 : 0;
  const emergencyDelayedSurgerySavings = config.emergencyFrameworkEnabled
    ? baselineAnnualDelayedSurgery * 0.50 : 0;

  interventions.push({
    name: 'Emergency Procurement Framework',
    description: 'Pre-approved blanket contracts for critical items during blackout. Reduces spot purchase premium from 30% to 12% and cuts blackout stockout duration by 65%.',
    annualExpirySavingsRs: 0,
    annualStockoutReductionPct: emergencyStockoutReduction,
    annualPatientOOPSavingsRs: emergencyOOPSavings,
    annualEmergencyPremiumSavingsRs: emergencyPremiumSavings,
    implementationCostRs: config.emergencyFrameworkEnabled ? 400_000 : 0,
    ongoingOpexRs: config.emergencyFrameworkEnabled ? 150_000 : 0,
    totalAnnualSavingsRs: emergencyPremiumSavings + emergencyOOPSavings + emergencyDelayedSurgerySavings,
    paybackMonths: 0,
    enabled: config.emergencyFrameworkEnabled,
  });

  // ── INTERVENTION 5: Advance Budget Requisition ──
  const advanceBudgetReductionPct = config.advanceBudgetRequest
    ? (28 / avgBlackoutDays) * 100 : 0;
  const advanceBudgetOOPSavings = config.advanceBudgetRequest
    ? baselineAnnualPatientOOP * 0.25 : 0;
  const advanceBudgetEmergencySavings = config.advanceBudgetRequest
    ? baselineAnnualEmergencyPremium * 0.30 : 0;

  interventions.push({
    name: 'Advance Budget Requisition',
    description: 'Hospital submits advance requisition 45 days before fiscal year-end. Shortens effective blackout window by 28 days each year.',
    annualExpirySavingsRs: 0,
    annualStockoutReductionPct: advanceBudgetReductionPct,
    annualPatientOOPSavingsRs: advanceBudgetOOPSavings,
    annualEmergencyPremiumSavingsRs: advanceBudgetEmergencySavings,
    implementationCostRs: config.advanceBudgetRequest ? 200_000 : 0,
    ongoingOpexRs: config.advanceBudgetRequest ? 80_000 : 0,
    totalAnnualSavingsRs: advanceBudgetOOPSavings + advanceBudgetEmergencySavings,
    paybackMonths: 0,
    enabled: config.advanceBudgetRequest,
  });

  // Calculate payback months for each
  interventions.forEach(iv => {
    if (iv.totalAnnualSavingsRs > 0 && iv.implementationCostRs > 0) {
      iv.paybackMonths = iv.implementationCostRs / (iv.totalAnnualSavingsRs / 12);
    }
  });

  // ── Projected annual totals ──
  const totalExpirySavings = interventions.reduce((s, iv) => s + iv.annualExpirySavingsRs, 0);
  const totalOOPSavings = interventions.reduce((s, iv) => s + iv.annualPatientOOPSavingsRs, 0);
  const totalEmergencySavings = interventions.reduce((s, iv) => s + iv.annualEmergencyPremiumSavingsRs, 0);

  // Stockout reduction is NOT additive — use diminishing returns
  const enabledStockoutReductions = interventions
    .filter(iv => iv.enabled && iv.annualStockoutReductionPct > 0)
    .map(iv => iv.annualStockoutReductionPct / 100);
  let combinedStockoutReduction = 0;
  for (const r of enabledStockoutReductions) {
    combinedStockoutReduction = combinedStockoutReduction + r * (1 - combinedStockoutReduction);
  }
  const projectedStockoutRate = baselineAnnualStockoutRate * (1 - combinedStockoutReduction);

  const projectedExpiryWaste = Math.max(0, baselineAnnualExpiry - totalExpirySavings);
  const projectedPatientOOP = Math.max(0, baselineAnnualPatientOOP - totalOOPSavings);
  const projectedEmergencyPremium = Math.max(0, baselineAnnualEmergencyPremium - totalEmergencySavings);
  const projectedDelayedSurgery = baselineAnnualDelayedSurgery * (1 - combinedStockoutReduction * 0.6);

  const totalSavings = (baselineAnnualExpiry - projectedExpiryWaste) +
    (baselineAnnualPatientOOP - projectedPatientOOP) +
    (baselineAnnualEmergencyPremium - projectedEmergencyPremium) +
    (baselineAnnualDelayedSurgery - projectedDelayedSurgery);

  const totalImplementation = interventions.reduce((s, iv) => s + iv.implementationCostRs, 0);
  const totalOngoingOpex = interventions.reduce((s, iv) => s + iv.ongoingOpexRs, 0);
  const netAnnualBenefit = totalSavings - totalOngoingOpex;
  const overallPayback = totalImplementation > 0 && netAnnualBenefit > 0
    ? totalImplementation / (netAnnualBenefit / 12) : 0;
  // ── Monthly projection ──
  const monthlyProjection: MonthlyProjection[] = sim.monthlyData.map((m, i) => {
    return {
      month: m.month,
      monthIndex: i,
      baselineExpiryRs: m.expiryWasteRs,
      projectedExpiryRs: m.expiryWasteRs * (1 - (totalExpirySavings / Math.max(1, baselineAnnualExpiry * 3))),
      baselineStockoutDays: m.criticalStockoutDays,
      projectedStockoutDays: Math.round(m.criticalStockoutDays * (1 - combinedStockoutReduction)),
      cumulativeSavingsRs: (totalSavings / 36) * (i + 1), // linear approximation
    };
  });

  // ── 5-Year ROI ──
  const fiveYearROI: YearlyROI[] = [];
  let cumulativeNet = 0;
  for (let y = 1; y <= 5; y++) {
    const investment = y === 1 ? totalImplementation + totalOngoingOpex : totalOngoingOpex;
    const savings = totalSavings;
    const net = savings - investment;
    cumulativeNet += net;

    fiveYearROI.push({
      year: y,
      label: `Year ${y}`,
      investmentRs: investment,
      savingsRs: savings,
      netRs: net,
      cumulativeNetRs: cumulativeNet,
      roiPct: investment > 0 ? ((savings - investment) / investment) * 100 : 0,
    });
  }

  return {
    config,
    baseline,
    interventions,
    projectedAnnual: {
      expiryWasteRs: projectedExpiryWaste,
      stockoutRate: projectedStockoutRate,
      patientOOPRs: projectedPatientOOP,
      emergencyPremiumRs: projectedEmergencyPremium,
      delayedSurgeryRs: projectedDelayedSurgery,
      totalSavingsRs: totalSavings,
      totalImplementationRs: totalImplementation,
      totalOngoingOpexRs: totalOngoingOpex,
      netAnnualBenefitRs: netAnnualBenefit,
      paybackMonths: overallPayback,
    },
    monthlyProjection,
    fiveYearROI,
  };
}
