/**
 * MedChain Insight — Simulation Data Engine
 * 
 * Generates 3 fiscal years (1,095 days) of synthetic hospital supply chain data
 * using a deterministic seeded PRNG (seed=42). All randomness flows through mulberry32.
 * 
 * Models 200 SKUs across 4 categories with:
 * - Seasonal demand patterns (dengue, respiratory, Eid, Ramadan)
 * - Pharmacist forecast error with directional bias
 * - Batch inventory with LIFO-biased picking
 * - Budget blackout windows
 * - PPRA procurement rules
 */

import { addDays, format, getDay, isWithinInterval } from 'date-fns';
import { SeededRandom } from './prng';
import type {
  SKU, Batch, MonthlyAggregate,
  FiscalYearSummary, SKUAnalysis, DailyTotal, SimulationResult, OverallMetrics,
} from './types';

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

const SEED = 42;
const SIM_START = new Date(2021, 6, 1); // July 1, 2021
const SIM_DAYS = 1095; // 3 fiscal years
const ANNUAL_BUDGET = 4_800_000_000; // Rs 4.8B
const PPRA_THRESHOLD = 2_000_000; // Rs 2M
const PATIENT_OOP_COST = 1200; // Rs per event
const SURGERY_DELAY_COST_PER_DAY = 450 * 2.3; // Rs 1,035

// Budget blackout windows (day-of-year offsets from July 1)
const BLACKOUT_WINDOWS = [
  { yearStart: 0,   blackoutEnd: 81, label: 'FY2022' },     // Jul 1 – Sep 19 (81 days)
  { yearStart: 365, blackoutEnd: 69, label: 'FY2023' },     // Jul 1 – Sep 8 (69 days)
  { yearStart: 730, blackoutEnd: 86, label: 'FY2024' },     // Jul 1 – Sep 25 (86 days)
];

// Q2 minor delays (12 days after Q2 start = Oct 1 + 12 = Oct 13)
const Q2_DELAY_START = 92; // days from July 1 to Oct 1
const Q2_DELAY_DURATION = 12;

// Seasonal events (approximate date ranges)
const DENGUE_SEASONS = [
  { start: new Date(2021, 6, 15), end: new Date(2021, 9, 31) },
  { start: new Date(2022, 6, 15), end: new Date(2022, 9, 31) },
  { start: new Date(2023, 6, 15), end: new Date(2023, 9, 31) },
];

const RESPIRATORY_SEASONS = [
  { start: new Date(2021, 10, 1), end: new Date(2022, 0, 31) },
  { start: new Date(2022, 10, 1), end: new Date(2023, 0, 31) },
  { start: new Date(2023, 10, 1), end: new Date(2024, 0, 31) },
];

// Eid al-Adha approximate dates ±7 days
const EID_PERIODS = [
  { start: new Date(2021, 6, 13), end: new Date(2021, 6, 27) },
  { start: new Date(2022, 6, 2), end: new Date(2022, 6, 16) },
  { start: new Date(2023, 5, 22), end: new Date(2023, 6, 6) },
];

// Ramadan approximate dates
const RAMADAN_PERIODS = [
  { start: new Date(2022, 3, 2), end: new Date(2022, 4, 1) },
  { start: new Date(2023, 2, 23), end: new Date(2023, 3, 21) },
  { start: new Date(2024, 2, 12), end: new Date(2024, 3, 10) },
];

// Pakistan public holidays (key dates)
const PUBLIC_HOLIDAYS: Date[] = [
  // 2021
  new Date(2021, 7, 14),  // Independence Day
  new Date(2021, 10, 9),  // Iqbal Day
  new Date(2021, 11, 25), // Quaid-e-Azam Day
  // 2022
  new Date(2022, 2, 23),  // Pakistan Day
  new Date(2022, 4, 1),   // Labour Day
  new Date(2022, 7, 14),  // Independence Day
  new Date(2022, 10, 9),  // Iqbal Day
  new Date(2022, 11, 25), // Quaid-e-Azam Day
  // 2023
  new Date(2023, 2, 23),  // Pakistan Day
  new Date(2023, 4, 1),   // Labour Day
  new Date(2023, 7, 14),  // Independence Day
  new Date(2023, 10, 9),  // Iqbal Day
  new Date(2023, 11, 25), // Quaid-e-Azam Day
  // 2024
  new Date(2024, 2, 23),  // Pakistan Day
  new Date(2024, 4, 1),   // Labour Day
];

// ──────────────────────────────────────────────
// SKU CATALOGUE GENERATION
// ──────────────────────────────────────────────

function generateSKUs(rng: SeededRandom): SKU[] {
  const skus: SKU[] = [];

  // 40 Critical items
  const criticalItems = [
    'Blood Bag (A+)', 'Blood Bag (B+)', 'Blood Bag (O+)', 'Blood Bag (AB+)',
    'IV Cannula 14G', 'IV Cannula 16G', 'IV Cannula 18G', 'IV Cannula 20G',
    'Normal Saline 500ml', 'Ringer Lactate 500ml', 'Dextrose 5% 500ml',
    'Ceftriaxone 1g Inj', 'Meropenem 1g Inj', 'Piperacillin-Tazobactam Inj',
    'Dopamine Inj', 'Adrenaline Inj', 'Noradrenaline Inj', 'Atropine Inj',
    'Surgical Gloves S', 'Surgical Gloves M', 'Surgical Gloves L',
    'Sutures Vicryl 2-0', 'Sutures Silk 3-0', 'Sutures Prolene 4-0',
    'Sutures Chromic Catgut', 'Sterile Drapes Large', 'Sterile Drapes Medium',
    'Cautery Pencils', 'Oxygen Masks Adult', 'Oxygen Masks Pediatric',
    'ET Tube 7.0mm', 'ET Tube 7.5mm', 'ET Tube 8.0mm',
    'Urinary Catheter 14Fr', 'Urinary Catheter 16Fr',
    'Nasogastric Tube 14Fr', 'Nasogastric Tube 16Fr',
    'Chest Tube 28Fr', 'Central Line Kit', 'Ventilator Circuit',
  ];

  criticalItems.forEach((name, i) => {
    skus.push({
      id: `CRIT-${String(i + 1).padStart(3, '0')}`,
      name,
      category: 'CRITICAL',
      shelfLifeDays: rng.uniformInt(365, 730),
      avgDailyConsumption: rng.uniform(8, 45),
      stdDev: rng.uniform(3, 15),
      contractPriceRs: rng.uniformInt(50, 3500),
      unitOfMeasure: 'units',
      leadTimeDays: rng.uniformInt(14, 28),
      safetyStockDays: 7,
    });
  });

  // 80 Routine medicines
  const routineItems = [
    'Paracetamol 500mg Tab', 'Paracetamol Syrup 120ml', 'Metformin 500mg Tab',
    'Metformin 850mg Tab', 'Amlodipine 5mg Tab', 'Amlodipine 10mg Tab',
    'Omeprazole 20mg Cap', 'Omeprazole 40mg Inj', 'Metronidazole 400mg Tab',
    'Metronidazole 500mg Inj', 'Amoxicillin 500mg Cap', 'Amoxicillin 250mg Syrup',
    'Ciprofloxacin 500mg Tab', 'Ciprofloxacin 200mg Inj', 'Atenolol 50mg Tab',
    'Losartan 50mg Tab', 'Enalapril 5mg Tab', 'Aspirin 75mg Tab',
    'Clopidogrel 75mg Tab', 'Warfarin 5mg Tab', 'Insulin Regular Vial',
    'Insulin NPH Vial', 'Insulin Glargine Pen', 'Metoclopramide 10mg Tab',
    'Ondansetron 4mg Tab', 'Ondansetron 8mg Inj', 'Diclofenac 50mg Tab',
    'Ibuprofen 400mg Tab', 'Tramadol 50mg Cap', 'Morphine 10mg Inj',
    'Diazepam 5mg Tab', 'Diazepam 10mg Inj', 'Midazolam 5mg Inj',
    'Phenytoin 100mg Cap', 'Carbamazepine 200mg Tab', 'Levetiracetam 500mg Tab',
    'Salbutamol Inhaler', 'Budesonide Inhaler', 'Ipratropium Nebuliser',
    'Aminophylline 250mg Inj', 'Hydrocortisone 100mg Inj', 'Dexamethasone 4mg Inj',
    'Prednisolone 5mg Tab', 'Furosemide 40mg Tab', 'Furosemide 20mg Inj',
    'Spironolactone 25mg Tab', 'Hydrochlorothiazide 25mg Tab',
    'Chlorpheniramine 4mg Tab', 'Cetirizine 10mg Tab', 'Ranitidine 150mg Tab',
    'Pantoprazole 40mg Inj', 'Esomeprazole 40mg Cap', 'Domperidone 10mg Tab',
    'Loperamide 2mg Cap', 'ORS Sachets', 'Zinc Sulfate 20mg Tab',
    'Ferrous Sulfate 200mg Tab', 'Folic Acid 5mg Tab', 'Calcium Carbonate 500mg Tab',
    'Vitamin D3 200000IU Inj', 'Vitamin B Complex Tab', 'Vitamin K 10mg Inj',
    'Heparin 5000IU Inj', 'Enoxaparin 40mg Inj', 'Tranexamic Acid 500mg Inj',
    'Mannitol 20% 500ml', 'Normal Saline 100ml', 'Dextrose 25% 25ml',
    'Potassium Chloride 40mEq', 'Sodium Bicarbonate 7.5%', 'Calcium Gluconate Inj',
    'Magnesium Sulfate Inj', 'Lignocaine 2% Inj', 'Bupivacaine 0.5% Inj',
    'Propofol 1% 20ml', 'Ketamine 500mg Inj', 'Succinylcholine Inj',
    'Atracurium 25mg Inj', 'Neostigmine 2.5mg Inj', 'Glycopyrrolate 0.2mg Inj',
  ];

  routineItems.forEach((name, i) => {
    skus.push({
      id: `ROUT-${String(i + 1).padStart(3, '0')}`,
      name,
      category: 'ROUTINE',
      shelfLifeDays: rng.uniformInt(365, 1095),
      avgDailyConsumption: rng.uniform(2, 25),
      stdDev: rng.uniform(1, 8),
      contractPriceRs: rng.uniformInt(5, 800),
      unitOfMeasure: 'units',
      leadTimeDays: rng.uniformInt(14, 28),
      safetyStockDays: 7,
    });
  });

  // 50 Lab reagents
  const labItems = [
    'Blood Glucose Strips (50s)', 'CBC Reagent Pack', 'Urine Dipstick (100s)',
    'Culture Media (Blood Agar)', 'Culture Media (MacConkey)', 'Gram Stain Kit',
    'Ziehl-Neelsen Stain', 'Giemsa Stain', 'Wright Stain',
    'PT/INR Reagent', 'APTT Reagent', 'D-Dimer Test Kit',
    'Troponin I Test Kit', 'CRP Test Strips', 'HbA1c Reagent',
    'Liver Function Test Kit', 'Kidney Function Panel', 'Electrolyte Analyzer Reagent',
    'Blood Gas Cartridge', 'Urinalysis Analyzer Strips', 'CSF Protein Reagent',
    'Bilirubin Reagent', 'Albumin Reagent', 'Amylase Reagent',
    'Lipase Reagent', 'Thyroid Function Kit', 'Pregnancy Test Kit',
    'HIV Rapid Test', 'HBsAg Rapid Test', 'HCV Rapid Test',
    'Dengue NS1 Test', 'Dengue IgM/IgG Kit', 'Malaria RDT Kit',
    'Widal Test Kit', 'ASO Test Kit', 'RF Latex Kit',
    'ANA Test Kit', 'Blood Typing Reagent (Anti-A)', 'Blood Typing Reagent (Anti-B)',
    'Blood Typing Reagent (Anti-D)', 'Cross-match Reagent', 'Coombs Test Reagent',
    'Semen Analysis Kit', 'Coagulation Control Normal', 'Coagulation Control Abnormal',
    'Chemistry Control Level 1', 'Chemistry Control Level 2',
    'Hematology Control', 'Microbiology QC Strain', 'Histology Embedding Wax',
  ];

  labItems.forEach((name, i) => {
    skus.push({
      id: `LAB-${String(i + 1).padStart(3, '0')}`,
      name,
      category: 'LAB_REAGENT',
      shelfLifeDays: rng.uniformInt(90, 180),
      avgDailyConsumption: rng.uniform(1, 15),
      stdDev: rng.uniform(1, 8),
      contractPriceRs: rng.uniformInt(200, 8000),
      unitOfMeasure: 'units',
      leadTimeDays: rng.uniformInt(14, 28),
      safetyStockDays: 7,
    });
  });

  // 30 Implants/high-value
  const implantItems = [
    'Ortho Screw 3.5mm SS', 'Ortho Screw 4.0mm SS', 'Ortho Screw 4.5mm Titanium',
    'DHS Plate 135°', 'DCS Plate', 'Locking Plate Proximal Femur',
    'Locking Plate Distal Tibia', 'Intramedullary Nail Femur', 'Intramedullary Nail Tibia',
    'Reconstruction Plate Mandible', 'Mini Plate Maxillofacial', 'Spine Pedicle Screw',
    'Spine Rod Titanium', 'Prolene Hernia Mesh 15x15', 'Prolene Hernia Mesh 30x30',
    'PTFE Vascular Graft 6mm', 'PTFE Vascular Graft 8mm', 'Cardiac Stent BMS',
    'Cardiac Stent DES', 'Cardiac Balloon Catheter', 'PTCA Guide Wire',
    'Pacemaker Single Chamber', 'Pacemaker Dual Chamber', 'Total Knee Implant Set',
    'Total Hip Implant Set', 'Austin Moore Prosthesis', 'Thompson Prosthesis',
    'Bipolar Hip Prosthesis', 'ACL Reconstruction Kit', 'External Fixator Set',
  ];

  implantItems.forEach((name, i) => {
    skus.push({
      id: `IMPL-${String(i + 1).padStart(3, '0')}`,
      name,
      category: 'IMPLANT',
      shelfLifeDays: rng.uniformInt(1825, 2555),
      avgDailyConsumption: rng.uniform(0.1, 0.8),
      stdDev: rng.uniform(0.05, 0.3),
      contractPriceRs: rng.uniformInt(8000, 180000),
      unitOfMeasure: 'units',
      leadTimeDays: rng.uniformInt(21, 42),
      safetyStockDays: 7,
    });
  });

  return skus;
}

// ──────────────────────────────────────────────
// SEASONAL MULTIPLIER
// ──────────────────────────────────────────────

function getSeasonalMultiplier(date: Date, sku: SKU): number {
  let multiplier = 1.0;
  const dayOfWeek = getDay(date);

  // Weekend effects
  if (dayOfWeek === 6) multiplier *= 0.75; // Saturday
  if (dayOfWeek === 0) multiplier *= 0.60; // Sunday

  // Public holidays
  const isHoliday = PUBLIC_HOLIDAYS.some(h =>
    h.getDate() === date.getDate() &&
    h.getMonth() === date.getMonth() &&
    h.getFullYear() === date.getFullYear()
  );
  if (isHoliday) multiplier *= 0.40;

  // Dengue season: IV fluids, antibiotics × 1.25
  const isDengue = DENGUE_SEASONS.some(s => isWithinInterval(date, s));
  if (isDengue) {
    if (sku.category === 'CRITICAL' && (
      sku.name.includes('Saline') || sku.name.includes('Ringer') ||
      sku.name.includes('Dextrose') || sku.name.includes('IV') ||
      sku.name.includes('Blood Bag')
    )) {
      multiplier *= 1.25;
    }
    if (sku.name.includes('Ceftriaxone') || sku.name.includes('Meropenem') ||
        sku.name.includes('Ciprofloxacin') || sku.name.includes('Metronidazole')) {
      multiplier *= 1.25;
    }
    // Lab reagent spike for dengue testing
    if (sku.name.includes('Dengue') || sku.name.includes('CBC')) {
      multiplier *= 1.50;
    }
  }

  // Respiratory season: bronchodilators, antibiotics × 1.20
  const isRespiratory = RESPIRATORY_SEASONS.some(s => isWithinInterval(date, s));
  if (isRespiratory) {
    if (sku.name.includes('Salbutamol') || sku.name.includes('Budesonide') ||
        sku.name.includes('Ipratropium') || sku.name.includes('Aminophylline')) {
      multiplier *= 1.20;
    }
    if (sku.name.includes('Amoxicillin') || sku.name.includes('Ceftriaxone')) {
      multiplier *= 1.20;
    }
  }

  // Eid al-Adha: surgical consumables × 1.35
  const isEid = EID_PERIODS.some(s => isWithinInterval(date, s));
  if (isEid) {
    if (sku.category === 'CRITICAL' && (
      sku.name.includes('Suture') || sku.name.includes('Gloves') ||
      sku.name.includes('Drape') || sku.name.includes('Cautery') ||
      sku.name.includes('Cannula')
    )) {
      multiplier *= 1.35;
    }
  }

  // Ramadan: OPD medicines × 1.15, surgical × 0.80
  const isRamadan = RAMADAN_PERIODS.some(s => isWithinInterval(date, s));
  if (isRamadan) {
    if (sku.category === 'ROUTINE') multiplier *= 1.15;
    if (sku.category === 'CRITICAL' && (
      sku.name.includes('Suture') || sku.name.includes('Drape') ||
      sku.name.includes('Cautery')
    )) {
      multiplier *= 0.80;
    }
    if (sku.category === 'IMPLANT') multiplier *= 0.80;
  }

  return multiplier;
}

// ──────────────────────────────────────────────
// BLACKOUT WINDOW CHECK
// ──────────────────────────────────────────────

function isInBlackout(dayIndex: number): boolean {
  for (const bw of BLACKOUT_WINDOWS) {
    const relDay = dayIndex - bw.yearStart;
    if (relDay >= 0 && relDay < bw.blackoutEnd) return true;
  }
  // Q2 minor delays
  for (const bw of BLACKOUT_WINDOWS) {
    const q2Start = bw.yearStart + Q2_DELAY_START;
    if (dayIndex >= q2Start && dayIndex < q2Start + Q2_DELAY_DURATION) return true;
  }
  return false;
}



// ──────────────────────────────────────────────
// MAIN SIMULATION
// ──────────────────────────────────────────────

function runSimulation(): SimulationResult {
  const rng = new SeededRandom(SEED);
  const skus = generateSKUs(rng);

  // Per-SKU state
  interface SKUState {
    batches: Batch[];
    lastStockoutDay: number;
    weeklyActualConsumption: number;
    weeklyForecastedConsumption: number;
    totalConsumed: number;
    totalExpired: number;
    totalExpiredValue: number;
    totalStockoutDays: number;
    totalForecasted: number;
    totalAbsForecastError: number;
    forecastCount: number;
    scheduledDeliveries: { day: number; qty: number; expiryDay: number }[];
    batchCounter: number;
  }

  const skuStates: Map<string, SKUState> = new Map();
  skus.forEach(sku => {
    skuStates.set(sku.id, {
      batches: [],
      lastStockoutDay: -999,
      weeklyActualConsumption: 0,
      weeklyForecastedConsumption: 0,
      totalConsumed: 0,
      totalExpired: 0,
      totalExpiredValue: 0,
      totalStockoutDays: 0,
      totalForecasted: 0,
      totalAbsForecastError: 0,
      forecastCount: 0,
      scheduledDeliveries: [],
      batchCounter: 0,
    });
  });

  // Budget tracking per fiscal year
  const budgets = [
    { remaining: ANNUAL_BUDGET, utilised: 0 },
    { remaining: ANNUAL_BUDGET, utilised: 0 },
    { remaining: ANNUAL_BUDGET, utilised: 0 },
  ];

  // Initialize with starting inventory (2-3 months of stock for each SKU)
  skus.forEach(sku => {
    const state = skuStates.get(sku.id)!;
    const initialQty = Math.round(sku.avgDailyConsumption * rng.uniformInt(45, 90));
    state.batches.push({
      batchId: `${sku.id}-INIT`,
      skuId: sku.id,
      arrivalDate: -30, // arrived 30 days before sim start
      expiryDate: -30 + sku.shelfLifeDays,
      initialQty,
      remainingQty: initialQty,
    });
  });

  // Daily totals storage
  const dailyTotals: DailyTotal[] = [];

  // Monthly aggregation buckets
  const monthlyBuckets: Map<string, MonthlyAggregate> = new Map();

  // Main simulation loop
  for (let day = 0; day < SIM_DAYS; day++) {
    const date = addDays(SIM_START, day);
    const monthKey = format(date, 'MMM yyyy');
    const fiscalYearIdx = Math.floor(day / 365);
    const budget = budgets[Math.min(fiscalYearIdx, 2)];
    const blackout = isInBlackout(day);
    const isWeekStart = day % 7 === 0;

    if (!monthlyBuckets.has(monthKey)) {
      monthlyBuckets.set(monthKey, {
        month: monthKey,
        monthIndex: monthlyBuckets.size,
        fiscalYear: fiscalYearIdx + 1,
        totalStockoutDays: 0,
        criticalStockoutDays: 0,
        expiryWasteRs: 0,
        expiryUnits: 0,
        emergencyPremiumRs: 0,
        patientOOPRs: 0,
        patientOOPEvents: 0,
        delayedSurgeryCostRs: 0,
        totalConsumption: 0,
        avgStockOnHand: 0,
        forecastMAPE: 0,
        budgetUtilisedRs: 0,
        inBlackout: blackout,
      });
    }
    const monthBucket = monthlyBuckets.get(monthKey)!;
    if (blackout) monthBucket.inBlackout = true;

    let dayTotalStockouts = 0;
    let dayTotalCriticalStockouts = 0;
    let dayExpiryWaste = 0;
    let dayEmergencyPremium = 0;
    let dayPatientOOP = 0;
    let dayDelayedSurgery = 0;
    let dayTotalStockValue = 0;

    for (const sku of skus) {
      const state = skuStates.get(sku.id)!;

      // 1. Receive scheduled deliveries
      const dueDeliveries = state.scheduledDeliveries.filter(d => d.day === day);
      for (const del of dueDeliveries) {
        state.batchCounter++;
        state.batches.push({
          batchId: `${sku.id}-B${state.batchCounter}`,
          skuId: sku.id,
          arrivalDate: day,
          expiryDate: del.expiryDay,
          initialQty: del.qty,
          remainingQty: del.qty,
        });
      }
      state.scheduledDeliveries = state.scheduledDeliveries.filter(d => d.day !== day);

      // 2. Calculate consumption
      const baseConsumption = Math.max(0, rng.gaussian(sku.avgDailyConsumption, sku.stdDev));
      const seasonalMultiplier = getSeasonalMultiplier(date, sku);
      const actualDemand = Math.max(0, Math.round(baseConsumption * seasonalMultiplier));

      // 3. LIFO-biased picking
      let consumed = 0;
      const liveBatches = state.batches.filter(b => b.remainingQty > 0 && b.expiryDate > day);
      if (liveBatches.length > 0 && actualDemand > 0) {
        let remaining = actualDemand;
        // Calculate LIFO weights
        const weights = liveBatches.map(b => 1 / Math.max(1, day - b.arrivalDate));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        // Distribute consumption across batches proportionally to weights
        for (let i = 0; i < liveBatches.length && remaining > 0; i++) {
          const proportion = weights[i] / totalWeight;
          const take = Math.min(
            Math.round(actualDemand * proportion),
            liveBatches[i].remainingQty,
            remaining
          );
          liveBatches[i].remainingQty -= take;
          consumed += take;
          remaining -= take;
        }
        // If there are leftovers due to rounding, take from newest batch
        if (remaining > 0) {
          const sortedByNewest = [...liveBatches].sort((a, b) => b.arrivalDate - a.arrivalDate);
          for (const batch of sortedByNewest) {
            const take = Math.min(remaining, batch.remainingQty);
            batch.remainingQty -= take;
            consumed += take;
            remaining -= take;
            if (remaining <= 0) break;
          }
        }
      }
      state.totalConsumed += consumed;

      // 4. Expire batches
      let expiredUnits = 0;
      state.batches = state.batches.filter(b => {
        if (b.expiryDate <= day && b.remainingQty > 0) {
          expiredUnits += b.remainingQty;
          return false; // remove expired batch
        }
        return true;
      });
      const expiredValue = expiredUnits * sku.contractPriceRs;
      state.totalExpired += expiredUnits;
      state.totalExpiredValue += expiredValue;

      // 5. Stock on hand
      const stockOnHand = state.batches.reduce((sum, b) => sum + b.remainingQty, 0);
      const stockout = stockOnHand === 0;

      if (stockout) {
        state.lastStockoutDay = day;
        state.totalStockoutDays++;
      }

      // 6. Weekly pharmacist forecast
      if (isWeekStart) {
        state.weeklyActualConsumption = 0; // reset for the week
        const daysSinceStockout = day - state.lastStockoutDay;
        let biasFactor: number;
        if (daysSinceStockout < 30) {
          biasFactor = rng.uniform(0.25, 0.45);
        } else if (daysSinceStockout > 90) {
          biasFactor = rng.uniform(-0.20, -0.10);
        } else {
          biasFactor = rng.uniform(-0.05, 0.10);
        }
        const noise = rng.uniform(-0.20, 0.20);
        const weeklyActual = sku.avgDailyConsumption * 7 * seasonalMultiplier;
        const forecast = weeklyActual * (1 + biasFactor + noise);
        state.weeklyForecastedConsumption = Math.max(0, forecast);

        // Track forecast error
        if (weeklyActual > 0) {
          state.totalAbsForecastError += Math.abs(forecast - weeklyActual) / weeklyActual;
          state.forecastCount++;
        }
      }
      state.weeklyActualConsumption += actualDemand;

      // 7. Procurement logic
      const daysOfCover = stockOnHand / Math.max(1, sku.avgDailyConsumption);
      const reorderPoint = sku.leadTimeDays + sku.safetyStockDays;

      if (daysOfCover < reorderPoint && !blackout && budget.remaining > 0) {
        // Order based on pharmacist forecast (not actual consumption)
        const forecast90days = (state.weeklyForecastedConsumption / 7) * 90;
        const orderQty = Math.max(1, Math.round(forecast90days));
        const orderValue = orderQty * sku.contractPriceRs;

        if (budget.remaining >= orderValue) {
          let deliveryDelay = rng.uniformInt(14, 28);
          if (orderValue > PPRA_THRESHOLD) {
            deliveryDelay += rng.uniformInt(14, 21); // PPRA committee delay
          }
          const deliveryDay = day + deliveryDelay;
          const expiryDay = deliveryDay + sku.shelfLifeDays;

          state.scheduledDeliveries.push({
            day: deliveryDay,
            qty: orderQty,
            expiryDay,
          });

          budget.remaining -= orderValue;
          budget.utilised += orderValue;
          monthBucket.budgetUtilisedRs += orderValue;
        }
      }

      // 8. Emergency spot purchase during blackout
      let emergencyPremium = 0;
      let patientOOPEvents = 0;
      let patientOOPCost = 0;
      let delayedSurgeryCost = 0;

      if (stockout) {
        if (sku.category === 'CRITICAL') {
          if (blackout) {
            // Emergency spot purchase
            const demandQty = Math.round(sku.avgDailyConsumption * 30);
            const maxQty = Math.floor(1_900_000 / sku.contractPriceRs);
            const purchaseQty = Math.min(demandQty, maxQty);
            const spotPremium = rng.uniform(1.25, 1.35);
            const spotCost = purchaseQty * sku.contractPriceRs * spotPremium;
            const contractCost = purchaseQty * sku.contractPriceRs;
            emergencyPremium = spotCost - contractCost;

            // Partial fulfillment → patient OOP
            if (purchaseQty < demandQty) {
              patientOOPEvents = Math.max(1, Math.round((demandQty - purchaseQty) / sku.avgDailyConsumption));
              patientOOPCost = patientOOPEvents * PATIENT_OOP_COST;
            }

            // Add emergency batch (arrives in 2-3 days)
            const emergencyDeliveryDay = day + rng.uniformInt(2, 3);
            state.scheduledDeliveries.push({
              day: emergencyDeliveryDay,
              qty: purchaseQty,
              expiryDay: emergencyDeliveryDay + sku.shelfLifeDays,
            });
          } else {
            // Non-blackout critical stockout still hurts patients
            patientOOPEvents = Math.ceil(actualDemand * 0.3);
            patientOOPCost = patientOOPEvents * PATIENT_OOP_COST;
          }
        }

        // Surgical item stockout → delayed surgery cost
        if (sku.name.includes('Suture') || sku.name.includes('Drape') ||
            sku.name.includes('Cautery') || sku.name.includes('Gloves') ||
            sku.category === 'IMPLANT') {
          delayedSurgeryCost = SURGERY_DELAY_COST_PER_DAY;
        }
      }

      // Aggregate into daily totals
      if (stockout) dayTotalStockouts++;
      if (stockout && sku.category === 'CRITICAL') dayTotalCriticalStockouts++;
      dayExpiryWaste += expiredValue;
      dayEmergencyPremium += emergencyPremium;
      dayPatientOOP += patientOOPCost;
      dayDelayedSurgery += delayedSurgeryCost;
      dayTotalStockValue += stockOnHand * sku.contractPriceRs;

      // Aggregate into monthly
      if (stockout) monthBucket.totalStockoutDays++;
      if (stockout && sku.category === 'CRITICAL') monthBucket.criticalStockoutDays++;
      monthBucket.expiryWasteRs += expiredValue;
      monthBucket.expiryUnits += expiredUnits;
      monthBucket.emergencyPremiumRs += emergencyPremium;
      monthBucket.patientOOPRs += patientOOPCost;
      monthBucket.patientOOPEvents += patientOOPEvents;
      monthBucket.delayedSurgeryCostRs += delayedSurgeryCost;
      monthBucket.totalConsumption += consumed;
    }

    dailyTotals.push({
      day,
      date,
      totalStockouts: dayTotalStockouts,
      criticalStockouts: dayTotalCriticalStockouts,
      expiryWasteRs: dayExpiryWaste,
      emergencyPremiumRs: dayEmergencyPremium,
      patientOOPRs: dayPatientOOP,
      delayedSurgeryCostRs: dayDelayedSurgery,
      totalStockOnHandRs: dayTotalStockValue,
      inBlackout: blackout,
    });
  }

  // ── Compute SKU-level analysis ──
  const skuAnalysis: SKUAnalysis[] = skus.map(sku => {
    const state = skuStates.get(sku.id)!;
    const avgMAPE = state.forecastCount > 0
      ? (state.totalAbsForecastError / state.forecastCount) * 100
      : 0;
    const totalConsumed = state.totalConsumed || 1;
    const avgDaysOfCover = (totalConsumed / SIM_DAYS) > 0
      ? state.batches.reduce((s, b) => s + b.remainingQty, 0) / (totalConsumed / SIM_DAYS)
      : 0;

    return {
      sku,
      totalExpiredUnits: state.totalExpired,
      totalExpiredValueRs: state.totalExpiredValue,
      totalStockoutDays: state.totalStockoutDays,
      avgMAPE,
      avgDaysOfCover,
      turnoverRate: totalConsumed / Math.max(1, totalConsumed + state.totalExpired),
    };
  });

  // ── Compute monthly MAPE averages ──
  const monthlyData = Array.from(monthlyBuckets.values());

  // Calculate overall forecast MAPE
  let totalMAPE = 0;
  let mapeCount = 0;
  skuAnalysis.forEach(sa => {
    if (sa.avgMAPE > 0) {
      totalMAPE += sa.avgMAPE;
      mapeCount++;
    }
  });

  monthlyData.forEach(m => {
    m.forecastMAPE = mapeCount > 0 ? totalMAPE / mapeCount : 0;
  });

  // ── Fiscal year summaries ──
  const fiscalYears: FiscalYearSummary[] = [0, 1, 2].map(fyIdx => {
    const fyMonths = monthlyData.filter(m => m.fiscalYear === fyIdx + 1);
    const fyLabel = `FY${2022 + fyIdx}`;

    const totalProcurement = budgets[fyIdx].utilised;
    const expiryWaste = fyMonths.reduce((s, m) => s + m.expiryWasteRs, 0);
    const totalStockoutDays = fyMonths.reduce((s, m) => s + m.totalStockoutDays, 0);
    const criticalStockoutDays = fyMonths.reduce((s, m) => s + m.criticalStockoutDays, 0);
    const emergencyPremium = fyMonths.reduce((s, m) => s + m.emergencyPremiumRs, 0);
    const patientOOP = fyMonths.reduce((s, m) => s + m.patientOOPRs, 0);
    const patientOOPEvents = fyMonths.reduce((s, m) => s + m.patientOOPEvents, 0);
    const delayedSurgery = fyMonths.reduce((s, m) => s + m.delayedSurgeryCostRs, 0);
    const blackoutDays = BLACKOUT_WINDOWS[fyIdx].blackoutEnd + Q2_DELAY_DURATION;

    // Critical stockout rate: critical stockout days / (total critical SKU-days)
    const totalCriticalSKUs = skus.filter(s => s.category === 'CRITICAL').length;
    const totalCriticalSKUDays = totalCriticalSKUs * 365;
    const criticalStockoutRate = (criticalStockoutDays / totalCriticalSKUDays) * 100;

    return {
      year: fyIdx + 1,
      label: fyLabel,
      totalProcurementRs: totalProcurement,
      expiryWasteRs: expiryWaste,
      expiryWastePct: totalProcurement > 0 ? (expiryWaste / totalProcurement) * 100 : 0,
      criticalStockoutRate,
      totalStockoutDays,
      criticalStockoutDays,
      emergencyPremiumRs: emergencyPremium,
      patientOOPRs: patientOOP,
      patientOOPEvents,
      delayedSurgeryCostRs: delayedSurgery,
      avgMAPE: totalMAPE / Math.max(1, mapeCount),
      blackoutDays,
      budgetUtilisationPct: totalProcurement > 0
        ? (totalProcurement / ANNUAL_BUDGET) * 100 : 0,
    };
  });

  // ── Overall metrics ──
  const overallMetrics: OverallMetrics = {
    totalExpiryWasteRs: fiscalYears.reduce((s, fy) => s + fy.expiryWasteRs, 0),
    totalEmergencyPremiumRs: fiscalYears.reduce((s, fy) => s + fy.emergencyPremiumRs, 0),
    totalPatientOOPRs: fiscalYears.reduce((s, fy) => s + fy.patientOOPRs, 0),
    totalPatientOOPEvents: fiscalYears.reduce((s, fy) => s + fy.patientOOPEvents, 0),
    totalDelayedSurgeryCostRs: fiscalYears.reduce((s, fy) => s + fy.delayedSurgeryCostRs, 0),
    avgCriticalStockoutRate: fiscalYears.reduce((s, fy) => s + fy.criticalStockoutRate, 0) / 3,
    avgExpiryRate: fiscalYears.reduce((s, fy) => s + fy.expiryWastePct, 0) / 3,
    avgMAPE: totalMAPE / Math.max(1, mapeCount),
    annualBudget: ANNUAL_BUDGET,
    totalProcured: budgets.reduce((s, b) => s + b.utilised, 0),
  };

  return {
    skus,
    monthlyData,
    fiscalYears,
    skuAnalysis,
    dailyTotals,
    overallMetrics,
  };
}

// ──────────────────────────────────────────────
// CACHED SINGLETON
// ──────────────────────────────────────────────

let cachedResult: SimulationResult | null = null;

export function getSimulationData(): SimulationResult {
  if (!cachedResult) {
    cachedResult = runSimulation();
  }
  return cachedResult;
}

export { ANNUAL_BUDGET, BLACKOUT_WINDOWS, SIM_START, SIM_DAYS };
