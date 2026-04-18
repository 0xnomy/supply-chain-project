/**
 * Per-SKU time series generator for detail charts.
 * Generates monthly snapshots, batch history, and forecast accuracy data
 * for any single SKU — calibrated to match aggregate simulation results.
 */

import { SeededRandom } from './prng';
import type { SKU, SKUAnalysis } from './types';

// Simple hash for deterministic per-SKU seeds
function hashSKU(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface SKUMonthlySnapshot {
  month: string;
  monthIndex: number;
  stockOnHand: number;
  consumed: number;
  expired: number;
  expiredValue: number;
  forecast: number;
  actual: number;
  stockoutDays: number;
  inBlackout: boolean;
  deliveries: number;
}

export interface BatchRecord {
  batchId: string;
  arrivalDay: number;
  expiryDay: number;
  initialQty: number;
  remainingQty: number;
  consumedQty: number;
  status: 'consumed' | 'expired' | 'active' | 'partial-expired';
  arrivalMonth: string;
  depletionDay: number;
}

export interface ForecastWeek {
  weekIndex: number;
  month: string;
  forecast: number;
  actual: number;
  error: number;
  mape: number;
}

export interface SKUFinancials {
  totalProcurementRs: number;
  totalExpiryWasteRs: number;
  expiryPct: number;
  emergencyPurchases: number;
  emergencyPremiumRs: number;
  stockoutDays: number;
  patientOOPEvents: number;
  avgMonthlySpend: number;
}

export interface SKUDetailData {
  monthly: SKUMonthlySnapshot[];
  batches: BatchRecord[];
  forecastWeeks: ForecastWeek[];
  financials: SKUFinancials;
}

const MONTHS = [
  'Jul 2021','Aug 2021','Sep 2021','Oct 2021','Nov 2021','Dec 2021',
  'Jan 2022','Feb 2022','Mar 2022','Apr 2022','May 2022','Jun 2022',
  'Jul 2022','Aug 2022','Sep 2022','Oct 2022','Nov 2022','Dec 2022',
  'Jan 2023','Feb 2023','Mar 2023','Apr 2023','May 2023','Jun 2023',
  'Jul 2023','Aug 2023','Sep 2023','Oct 2023','Nov 2023','Dec 2023',
  'Jan 2024','Feb 2024','Mar 2024','Apr 2024','May 2024','Jun 2024',
];

const DAYS_IN_MONTH = [31,31,30,31,30,31, 31,28,31,30,31,30, 31,31,30,31,30,31, 31,29,31,30,31,30, 31,31,30,31,30,31, 31,28,31,30,31,30];

// Blackout months (0-indexed into MONTHS array)
const BLACKOUT_MONTH_INDICES = new Set([0,1,2, 12,13,14, 24,25,26]); // Jul,Aug,Sep of each year (approximate)
// More precise: Jul fully blocked, Aug fully blocked, Sep partially
const FULL_BLACKOUT_MONTHS = new Set([0,1, 12,13, 24,25]); // Jul+Aug each FY

function getSeasonalMultiplier(monthIdx: number, sku: SKU, rng: SeededRandom): number {
  const monthInYear = monthIdx % 12;
  let mult = 1.0;

  // Dengue: Jul-Oct (indices 0-3 in FY months)
  if (monthInYear >= 0 && monthInYear <= 3) {
    if (sku.category === 'CRITICAL' && (
      sku.name.includes('Saline') || sku.name.includes('Cannula') ||
      sku.name.includes('Blood') || sku.name.includes('Ringer')
    )) mult *= 1.25;
  }

  // Respiratory: Nov-Jan (indices 4-6)
  if (monthInYear >= 4 && monthInYear <= 6) {
    if (sku.name.includes('Salbutamol') || sku.name.includes('Amoxicillin') ||
        sku.name.includes('Ceftriaxone')) mult *= 1.20;
  }

  // Eid: around Jul (index 0-1)
  if (monthInYear === 0 || monthInYear === 1) {
    if (sku.name.includes('Suture') || sku.name.includes('Gloves')) mult *= 1.35;
  }

  // Ramadan: around Mar-Apr (indices 8-9 of FY)
  if (monthInYear === 8 || monthInYear === 9) {
    if (sku.category === 'ROUTINE') mult *= 1.15;
    if (sku.category === 'IMPLANT') mult *= 0.80;
  }

  // Weekend effect averaged: ~15% reduction
  mult *= 0.88;

  // Random noise
  mult *= (1 + rng.uniform(-0.05, 0.05));

  return mult;
}

export function generateSKUTimeSeries(sku: SKU, analysis: SKUAnalysis): SKUDetailData {
  const rng = new SeededRandom(hashSKU(sku.id) + 42);

  // ── Generate monthly snapshots ──
  const monthly: SKUMonthlySnapshot[] = [];
  let currentStock = Math.round(sku.avgDailyConsumption * rng.uniformInt(50, 80));
  let lastStockoutMonth = -999;

  // Calibration: distribute total expiry and stockout across months
  const totalExpiry = analysis.totalExpiredValueRs;
  const totalStockoutDays = analysis.totalStockoutDays;
  const avgMonthlyExpiry = totalExpiry / 36;
  const avgMonthlyStockoutDays = totalStockoutDays / 36;

  for (let m = 0; m < 36; m++) {
    const daysInMonth = DAYS_IN_MONTH[m];
    const seasonal = getSeasonalMultiplier(m, sku, rng);
    const monthlyConsumption = Math.round(sku.avgDailyConsumption * daysInMonth * seasonal);

    const isBlackout = BLACKOUT_MONTH_INDICES.has(m);
    const isFullBlackout = FULL_BLACKOUT_MONTHS.has(m);

    // Forecast with bias
    const daysSinceStockout = m - lastStockoutMonth;
    let biasFactor: number;
    if (daysSinceStockout <= 2) {
      biasFactor = rng.uniform(0.25, 0.45);
    } else if (daysSinceStockout > 6) {
      biasFactor = rng.uniform(-0.20, -0.10);
    } else {
      biasFactor = rng.uniform(-0.05, 0.10);
    }
    const noise = rng.uniform(-0.20, 0.20);
    const forecast = Math.max(0, Math.round(monthlyConsumption * (1 + biasFactor + noise)));

    // Consumption from stock
    const consumed = Math.min(currentStock, monthlyConsumption);
    currentStock -= consumed;

    // Expiry events (higher for lab reagents, during non-blackout months)
    let expired = 0;
    let expiredValue = 0;
    if (sku.category === 'LAB_REAGENT') {
      // Lab reagents expire frequently due to short shelf life
      expired = Math.round(rng.uniform(0.05, 0.25) * consumed * (isBlackout ? 0.3 : 1.0));
    } else if (currentStock > sku.avgDailyConsumption * 60 && !isBlackout) {
      // Overstock → some expiry (LIFO effect)
      expired = Math.round(rng.uniform(0, 0.08) * currentStock);
    }
    // Scale to match total expiry
    const expiryScale = totalExpiry > 0 ? (avgMonthlyExpiry / Math.max(1, expired * sku.contractPriceRs)) : 0;
    expired = Math.round(expired * Math.min(3, Math.max(0.2, expiryScale)));
    expiredValue = expired * sku.contractPriceRs;

    // Stockout detection
    let stockoutDays = 0;
    if (currentStock <= 0) {
      stockoutDays = isFullBlackout ? Math.round(daysInMonth * rng.uniform(0.6, 0.95)) :
                     isBlackout ? Math.round(daysInMonth * rng.uniform(0.3, 0.6)) :
                     Math.round(daysInMonth * rng.uniform(0.05, 0.25));
      lastStockoutMonth = m;
    } else if (currentStock < sku.avgDailyConsumption * 7) {
      stockoutDays = Math.round(rng.uniform(1, 5));
    }

    // Scale stockout days to match aggregate
    const stockoutScale = totalStockoutDays > 0 ? (avgMonthlyStockoutDays / Math.max(1, stockoutDays)) : 0;
    stockoutDays = Math.round(stockoutDays * Math.min(4, Math.max(0.1, stockoutScale)));
    stockoutDays = Math.min(stockoutDays, daysInMonth);

    // Procurement (deliveries)
    let deliveries = 0;
    if (!isFullBlackout && currentStock < sku.avgDailyConsumption * 30) {
      deliveries = rng.uniformInt(1, 2);
      const orderQty = Math.round(forecast * (90 / daysInMonth));
      currentStock += orderQty;
    } else if (isBlackout && currentStock <= 0 && sku.category === 'CRITICAL') {
      // Emergency during blackout
      deliveries = 1;
      currentStock += Math.round(sku.avgDailyConsumption * rng.uniformInt(5, 15));
    }

    monthly.push({
      month: MONTHS[m],
      monthIndex: m,
      stockOnHand: Math.max(0, currentStock),
      consumed,
      expired,
      expiredValue,
      forecast,
      actual: monthlyConsumption,
      stockoutDays,
      inBlackout: isBlackout,
      deliveries,
    });


  }

  // ── Generate batch history ──
  const batches: BatchRecord[] = [];
  let batchDay = -30;
  let batchCount = 0;

  // Initial batch
  const initQty = Math.round(sku.avgDailyConsumption * rng.uniformInt(50, 80));
  batches.push({
    batchId: `${sku.id}-INIT`,
    arrivalDay: -30,
    expiryDay: -30 + sku.shelfLifeDays,
    initialQty: initQty,
    remainingQty: 0,
    consumedQty: initQty,
    status: sku.shelfLifeDays < 180 ? 'partial-expired' : 'consumed',
    arrivalMonth: 'Jun 2021',
    depletionDay: Math.round(initQty / Math.max(1, sku.avgDailyConsumption)),
  });

  // Generate procurement batches
  let currentDay = 0;
  for (let m = 0; m < 36; m++) {
    const daysInMonth = DAYS_IN_MONTH[m];
    const isBlackout = FULL_BLACKOUT_MONTHS.has(m);

    if (!isBlackout) {
      // Regular procurement: every ~45-90 days
      if (currentDay - batchDay > rng.uniformInt(45, 90)) {
        batchCount++;
        const qty = Math.round(sku.avgDailyConsumption * rng.uniformInt(60, 120));
        const arrDay = currentDay + rng.uniformInt(0, daysInMonth - 1);
        const expDay = arrDay + sku.shelfLifeDays;
        const consumptionDays = Math.round(qty / Math.max(0.1, sku.avgDailyConsumption));

        // LIFO effect: newer batches consumed faster
        const isNewerBatch = batchCount > batches.length / 2;
        const lifoFactor = isNewerBatch ? rng.uniform(0.5, 0.8) : rng.uniform(1.2, 2.0);
        const adjustedConsumptionDays = Math.round(consumptionDays * lifoFactor);
        const depDay = arrDay + adjustedConsumptionDays;

        let status: BatchRecord['status'];
        let remaining = 0;
        let consumed = qty;

        if (depDay > 1095) {
          status = 'active';
          remaining = Math.round(qty * rng.uniform(0.3, 0.7));
          consumed = qty - remaining;
        } else if (depDay >= expDay && sku.shelfLifeDays < 365) {
          // Expired before consumed (LIFO victim - old batch)
          remaining = Math.round(qty * rng.uniform(0.1, 0.4));
          consumed = qty - remaining;
          status = 'expired';
        } else if (depDay >= expDay * 0.9) {
          status = 'partial-expired';
          remaining = Math.round(qty * rng.uniform(0.05, 0.15));
          consumed = qty - remaining;
        } else {
          status = 'consumed';
          remaining = 0;
          consumed = qty;
        }

        batches.push({
          batchId: `${sku.id}-B${batchCount}`,
          arrivalDay: arrDay,
          expiryDay: expDay,
          initialQty: qty,
          remainingQty: remaining,
          consumedQty: consumed,
          status,
          arrivalMonth: MONTHS[m],
          depletionDay: Math.min(depDay, expDay, 1095),
        });

        batchDay = arrDay;
      }
    } else if (sku.category === 'CRITICAL' && rng.next() > 0.5) {
      // Emergency batch during blackout
      batchCount++;
      const qty = Math.round(sku.avgDailyConsumption * rng.uniformInt(10, 25));
      const arrDay = currentDay + rng.uniformInt(5, 15);

      batches.push({
        batchId: `${sku.id}-EMR${batchCount}`,
        arrivalDay: arrDay,
        expiryDay: arrDay + sku.shelfLifeDays,
        initialQty: qty,
        remainingQty: 0,
        consumedQty: qty,
        status: 'consumed',
        arrivalMonth: MONTHS[m],
        depletionDay: arrDay + Math.round(qty / Math.max(0.1, sku.avgDailyConsumption)),
      });

      batchDay = arrDay;
    }

    currentDay += daysInMonth;
  }

  // ── Generate weekly forecast data ──
  const forecastWeeks: ForecastWeek[] = [];
  const rng2 = new SeededRandom(hashSKU(sku.id) + 100);

  for (let w = 0; w < 156; w++) { // 156 weeks in 3 years
    const monthIdx = Math.min(35, Math.floor((w * 7) / 30));
    const seasonal = getSeasonalMultiplier(monthIdx, sku, rng2);
    const weeklyActual = Math.max(0, Math.round(sku.avgDailyConsumption * 7 * seasonal * (1 + rng2.uniform(-0.15, 0.15))));

    // Forecast with bias pattern
    const daysSinceStockout = (monthly[monthIdx]?.stockoutDays || 0) > 0 ? rng2.uniformInt(0, 30) : rng2.uniformInt(30, 200);
    let bias: number;
    if (daysSinceStockout < 30) {
      bias = rng2.uniform(0.25, 0.45);
    } else if (daysSinceStockout > 90) {
      bias = rng2.uniform(-0.20, -0.10);
    } else {
      bias = rng2.uniform(-0.05, 0.10);
    }
    const forecastNoise = rng2.uniform(-0.20, 0.20);
    const weeklyForecast = Math.max(0, Math.round(weeklyActual * (1 + bias + forecastNoise)));

    const error = weeklyForecast - weeklyActual;
    const mape = weeklyActual > 0 ? (Math.abs(error) / weeklyActual) * 100 : 0;

    forecastWeeks.push({
      weekIndex: w,
      month: MONTHS[monthIdx],
      forecast: weeklyForecast,
      actual: weeklyActual,
      error,
      mape,
    });


  }

  // ── Financials ──
  const totalProcured = batches.reduce((s, b) => s + b.initialQty, 0);
  const emergencyBatches = batches.filter(b => b.batchId.includes('EMR'));
  const financials: SKUFinancials = {
    totalProcurementRs: totalProcured * sku.contractPriceRs,
    totalExpiryWasteRs: analysis.totalExpiredValueRs,
    expiryPct: totalProcured > 0 ? (analysis.totalExpiredUnits / totalProcured) * 100 : 0,
    emergencyPurchases: emergencyBatches.length,
    emergencyPremiumRs: emergencyBatches.reduce((s, b) => s + b.initialQty * sku.contractPriceRs * 0.30, 0),
    stockoutDays: analysis.totalStockoutDays,
    patientOOPEvents: sku.category === 'CRITICAL' ? Math.round(analysis.totalStockoutDays * 0.8) : 0,
    avgMonthlySpend: (totalProcured * sku.contractPriceRs) / 36,
  };

  return { monthly, batches, forecastWeeks, financials };
}

// Cache for computed SKU detail data
const cache = new Map<string, SKUDetailData>();

export function getSKUDetailData(sku: SKU, analysis: SKUAnalysis): SKUDetailData {
  if (!cache.has(sku.id)) {
    cache.set(sku.id, generateSKUTimeSeries(sku, analysis));
  }
  return cache.get(sku.id)!;
}
