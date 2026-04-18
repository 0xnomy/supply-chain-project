/** Core type definitions for MedChain Insight simulation */

export type CriticalityTier = 'CRITICAL' | 'ROUTINE' | 'LAB_REAGENT' | 'IMPLANT';

export interface SKU {
  id: string;
  name: string;
  category: CriticalityTier;
  shelfLifeDays: number;
  avgDailyConsumption: number;
  stdDev: number;
  contractPriceRs: number;
  unitOfMeasure: string;
  leadTimeDays: number;
  safetyStockDays: number;
}

export interface Batch {
  batchId: string;
  skuId: string;
  arrivalDate: number; // day index
  expiryDate: number; // day index
  initialQty: number;
  remainingQty: number;
}

export interface DailyRecord {
  day: number;
  date: Date;
  skuId: string;
  baseConsumption: number;
  seasonalMultiplier: number;
  actualConsumption: number;
  pharmacistForecast: number;
  stockOnHand: number;
  stockoutFlag: boolean;
  expiredUnits: number;
  expiredValueRs: number;
  emergencyPurchaseQty: number;
  emergencyPurchaseCostRs: number;
  patientOOPEvents: number;
  patientOOPCostRs: number;
  delayedSurgeryCostRs: number;
  deliveriesReceived: number;
  orderPlaced: boolean;
  orderQty: number;
  orderValueRs: number;
  inBlackout: boolean;
}

export interface MonthlyAggregate {
  month: string; // "Jul 2021"
  monthIndex: number;
  fiscalYear: number; // 1, 2, or 3
  totalStockoutDays: number;
  criticalStockoutDays: number;
  expiryWasteRs: number;
  expiryUnits: number;
  emergencyPremiumRs: number;
  patientOOPRs: number;
  patientOOPEvents: number;
  delayedSurgeryCostRs: number;
  totalConsumption: number;
  avgStockOnHand: number;
  forecastMAPE: number;
  budgetUtilisedRs: number;
  inBlackout: boolean;
}

export interface FiscalYearSummary {
  year: number;
  label: string;
  totalProcurementRs: number;
  expiryWasteRs: number;
  expiryWastePct: number;
  criticalStockoutRate: number;
  totalStockoutDays: number;
  criticalStockoutDays: number;
  emergencyPremiumRs: number;
  patientOOPRs: number;
  patientOOPEvents: number;
  delayedSurgeryCostRs: number;
  avgMAPE: number;
  blackoutDays: number;
  budgetUtilisationPct: number;
}

export interface SKUAnalysis {
  sku: SKU;
  totalExpiredUnits: number;
  totalExpiredValueRs: number;
  totalStockoutDays: number;
  avgMAPE: number;
  avgDaysOfCover: number;
  turnoverRate: number;
}

export interface SimulationResult {
  skus: SKU[];
  monthlyData: MonthlyAggregate[];
  fiscalYears: FiscalYearSummary[];
  skuAnalysis: SKUAnalysis[];
  dailyTotals: DailyTotal[];
  overallMetrics: OverallMetrics;
}

export interface DailyTotal {
  day: number;
  date: Date;
  totalStockouts: number;
  criticalStockouts: number;
  expiryWasteRs: number;
  emergencyPremiumRs: number;
  patientOOPRs: number;
  delayedSurgeryCostRs: number;
  totalStockOnHandRs: number;
  inBlackout: boolean;
}

export interface OverallMetrics {
  totalExpiryWasteRs: number;
  totalEmergencyPremiumRs: number;
  totalPatientOOPRs: number;
  totalPatientOOPEvents: number;
  totalDelayedSurgeryCostRs: number;
  avgCriticalStockoutRate: number;
  avgExpiryRate: number;
  avgMAPE: number;
  annualBudget: number;
  totalProcured: number;
}

// ---- Scenario Engine Types ----

export interface ScenarioConfig {
  prePositioningSafetyDays: number; // 7 = off, 30-120 = on
  fifoEnforced: boolean;
  consumptionBasedReorder: boolean;
  emergencyFrameworkEnabled: boolean;
  advanceBudgetRequest: boolean;
}

export interface InterventionImpact {
  name: string;
  description: string;
  annualExpirySavingsRs: number;
  annualStockoutReductionPct: number;
  annualPatientOOPSavingsRs: number;
  annualEmergencyPremiumSavingsRs: number;
  implementationCostRs: number;
  ongoingOpexRs: number;
  totalAnnualSavingsRs: number;
  paybackMonths: number;
  enabled: boolean;
}

export interface ScenarioResult {
  config: ScenarioConfig;
  baseline: {
    annualExpiryWasteRs: number;
    annualStockoutRate: number;
    annualPatientOOPRs: number;
    annualEmergencyPremiumRs: number;
    annualDelayedSurgeryRs: number;
  };
  interventions: InterventionImpact[];
  projectedAnnual: {
    expiryWasteRs: number;
    stockoutRate: number;
    patientOOPRs: number;
    emergencyPremiumRs: number;
    delayedSurgeryRs: number;
    totalSavingsRs: number;
    totalImplementationRs: number;
    totalOngoingOpexRs: number;
    netAnnualBenefitRs: number;
    paybackMonths: number;
  };
  monthlyProjection: MonthlyProjection[];
  fiveYearROI: YearlyROI[];
}

export interface MonthlyProjection {
  month: string;
  monthIndex: number;
  baselineExpiryRs: number;
  projectedExpiryRs: number;
  baselineStockoutDays: number;
  projectedStockoutDays: number;
  cumulativeSavingsRs: number;
}

export interface YearlyROI {
  year: number;
  label: string;
  investmentRs: number;
  savingsRs: number;
  netRs: number;
  cumulativeNetRs: number;
  roiPct: number;
}

export interface RiskItem {
  id: string;
  category: 'technical' | 'organizational' | 'financial' | 'regulatory';
  title: string;
  description: string;
  likelihood: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
  riskScore: number;
  mitigation: string;
  owner: string;
  timeline: string;
}

export interface RoadmapPhase {
  id: string;
  phase: number;
  name: string;
  duration: string;
  startMonth: number;
  endMonth: number;
  description: string;
  activities: string[];
  deliverables: string[];
  investmentRs: number;
  dependencies: string[];
  risks: string[];
  kpis: { metric: string; target: string }[];
}
