"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  Calculator, Shield, Package, Download,
} from "lucide-react";
import { getSimulationData } from "@/lib/simulation/dataEngine";
import { formatRs } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; stroke?: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-[#0F172A] font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || entry.stroke }}>
          {entry.name}: {typeof entry.value === "number" && Math.abs(entry.value) > 1000
            ? formatRs(entry.value) : typeof entry.value === "number" ? Math.round(entry.value).toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

// ───── TOOL 1: Blackout Survival Planner ─────
function BlackoutSurvivalPlanner() {
  const sim = useMemo(() => getSimulationData(), []);

  const [blackoutDays, setBlackoutDays] = useState(81);
  const [emergencyFramework, setEmergencyFramework] = useState(false);

  const plannerData = useMemo(() => {
    const criticalSKUs = sim.skus.filter(s => s.category === "CRITICAL");
    return criticalSKUs.map(sku => {
      const currentStock = Math.round(sku.avgDailyConsumption * 25); // ~25 days of cover (simulated current)
      const dailyConsumption = sku.avgDailyConsumption;
      const daysOfCover = currentStock / Math.max(0.1, dailyConsumption);
      const willRunOut = daysOfCover < blackoutDays;

      const shortfall = willRunOut ? Math.round((blackoutDays - daysOfCover) * dailyConsumption) : 0;
      const effectiveShortfall = emergencyFramework ? Math.round(shortfall * 0.35) : shortfall;
      const preOrderQty = Math.max(0, effectiveShortfall);
      const preOrderCost = preOrderQty * sku.contractPriceRs;

      return {
        id: sku.id,
        name: sku.name,
        currentStock,
        dailyConsumption: Math.round(dailyConsumption * 10) / 10,
        daysOfCover: Math.round(daysOfCover),
        willRunOut,
        shortfall: effectiveShortfall,
        preOrderQty,
        preOrderCost,
        contractPrice: sku.contractPriceRs,
      };
    });
  }, [sim, blackoutDays, emergencyFramework]);

  const totals = useMemo(() => ({
    totalCost: plannerData.reduce((s, d) => s + d.preOrderCost, 0),
    shortfallItems: plannerData.filter(d => d.willRunOut).length,
    totalQty: plannerData.reduce((s, d) => s + d.preOrderQty, 0),
    storageEstimate: Math.round(plannerData.reduce((s, d) => s + d.preOrderQty, 0) * 0.002), // rough m²
  }), [plannerData]);

  const handleExport = useCallback(() => {
    const data = {
      generated: new Date().toISOString(),
      blackoutDays,
      emergencyFramework,
      totalAdditionalProcurement: totals.totalCost,
      items: plannerData.filter(d => d.willRunOut).map(d => ({
        sku: d.name,
        currentStock: d.currentStock,
        shortfall: d.shortfall,
        recommendedOrder: d.preOrderQty,
        estimatedCost: d.preOrderCost,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blackout-survival-plan.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [plannerData, blackoutDays, emergencyFramework, totals]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          Blackout Survival Planner
        </CardTitle>
        <p className="text-sm text-[#64748B]">
          How much stock do you need to survive the Q1 budget freeze?
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Slider
              min={45}
              max={120}
              step={1}
              value={blackoutDays}
              onChange={setBlackoutDays}
              label="Expected Blackout Duration"
              formatValue={(v) => `${v} days`}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={emergencyFramework} onCheckedChange={setEmergencyFramework} />
            <span className="text-sm text-[#64748B]">Include emergency framework?</span>
          </div>
          <div className="flex items-center gap-2">
            <StatCard title="Items at Risk" value={`${totals.shortfallItems} / ${plannerData.length}`} variant="danger" className="flex-1" />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left py-2 px-2 text-[#64748B] font-medium text-xs">SKU</th>
                <th className="text-right py-2 px-2 text-[#64748B] font-medium text-xs">Current Stock</th>
                <th className="text-right py-2 px-2 text-[#64748B] font-medium text-xs">Daily Use</th>
                <th className="text-right py-2 px-2 text-[#64748B] font-medium text-xs">Days Cover</th>
                <th className="text-center py-2 px-2 text-[#64748B] font-medium text-xs">Run Out?</th>
                <th className="text-right py-2 px-2 text-[#64748B] font-medium text-xs">Shortfall</th>
                <th className="text-right py-2 px-2 text-[#64748B] font-medium text-xs">Pre-Order Qty</th>
                <th className="text-right py-2 px-2 text-[#64748B] font-medium text-xs">Cost</th>
              </tr>
            </thead>
            <tbody>
              {plannerData.map(d => (
                <tr key={d.id} className={`border-b border-[#E2E8F0] ${d.willRunOut ? "bg-red-50/10" : ""}`}>
                  <td className="py-2 px-2 text-xs text-[#0F172A]">{d.name}</td>
                  <td className="py-2 px-2 text-right text-xs text-[#64748B]">{d.currentStock}</td>
                  <td className="py-2 px-2 text-right text-xs text-[#64748B]">{d.dailyConsumption}</td>
                  <td className="py-2 px-2 text-right text-xs">
                    <span className={d.daysOfCover < blackoutDays ? "text-red-400 font-semibold" : "text-green-400"}>
                      {d.daysOfCover}d
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    {d.willRunOut ? (
                      <Badge variant="danger" className="text-[8px]">YES</Badge>
                    ) : (
                      <Badge variant="success" className="text-[8px]">NO</Badge>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right text-xs text-red-400">{d.shortfall > 0 ? d.shortfall : "—"}</td>
                  <td className="py-2 px-2 text-right text-xs text-accent">{d.preOrderQty > 0 ? d.preOrderQty : "—"}</td>
                  <td className="py-2 px-2 text-right text-xs text-[#64748B]">{d.preOrderCost > 0 ? formatRs(d.preOrderCost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#E2E8F0]">
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-[#64748B]">Total Additional Procurement</p>
              <p className="text-lg font-bold text-[#0F172A]">{formatRs(totals.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Storage Estimate</p>
              <p className="text-lg font-bold text-accent">{totals.storageEstimate} m²</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-[#0F172A] rounded-lg text-sm font-medium hover:bg-accent-600 transition-all"
          >
            <Download className="w-4 h-4" />
            Export Plan (JSON)
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ───── TOOL 2: Forecast Error Cost Calculator ─────
function ForecastErrorCalculator() {
  const [mape, setMape] = useState(40);
  const [biasDirection, setBiasDirection] = useState<"over" | "balanced" | "under">("balanced");

  const costData = useMemo(() => {
    const points: { mape: number; expiryWaste: number; stockoutEvents: number; totalCost: number }[] = [];
    for (let m = 5; m <= 60; m += 1) {
      const baseExpiry = 648_000_000; // Rs 648M at 40% MAPE
      const baseStockouts = 400_000; // events at 40% MAPE

      // Non-linear relationship: cost scales roughly quadratically with MAPE

      // Non-linear relationship: cost scales roughly quadratically with MAPE
      const mapeRatio = m / 40;
      const expiryWaste = Math.round(baseExpiry * Math.pow(mapeRatio, 1.5) * (biasDirection === "over" ? 1.3 : biasDirection === "under" ? 0.7 : 1.0));
      const stockoutEvents = Math.round(baseStockouts * Math.pow(mapeRatio, 1.2) * (biasDirection === "under" ? 1.3 : biasDirection === "over" ? 0.7 : 1.0));
      const totalCost = expiryWaste + stockoutEvents * 1200;

      points.push({ mape: m, expiryWaste, stockoutEvents, totalCost });
    }
    return points;
  }, [biasDirection]);

  const currentPoint = useMemo(() => {
    return costData.find(d => d.mape === mape) || costData[0];
  }, [costData, mape]);

  const target15Point = useMemo(() => {
    return costData.find(d => d.mape === 15) || costData[0];
  }, [costData]);

  // Breakeven MAPE (where expiry cost = stockout cost)
  const breakevenMAPE = useMemo(() => {
    for (const d of costData) {
      if (d.expiryWaste <= d.stockoutEvents * 1200) return d.mape;
    }
    return 25;
  }, [costData]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-amber-400" />
          Forecast Error Cost Calculator
        </CardTitle>
        <p className="text-sm text-[#64748B]">
          How much does inaccurate demand forecasting actually cost?
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Slider
              min={5}
              max={60}
              step={1}
              value={mape}
              onChange={setMape}
              label="Forecast MAPE"
              formatValue={(v) => `${v}%`}
            />
          </div>
          <div>
            <p className="text-sm text-[#64748B] mb-2">Bias Direction</p>
            <div className="flex gap-2">
              {(["over", "balanced", "under"] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setBiasDirection(b)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 ${
                    biasDirection === b
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-white text-[#64748B] border border-[#E2E8F0]"
                  }`}
                >
                  {b === "over" ? "Over-forecast" : b === "under" ? "Under-forecast" : "Balanced"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 w-full">
              <p className="text-xs text-[#64748B]">Per 1% MAPE reduction</p>
              <p className="text-sm font-bold text-green-400">{formatRs(48_000_000 + 22_000_000)} savings</p>
            </div>
          </div>
        </div>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={costData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F099" />
              <XAxis
                dataKey="mape"
                tick={{ fill: "#64748B", fontSize: 10 }}
                label={{ value: "Forecast MAPE (%)", position: "bottom", fill: "#64748B", fontSize: 11 }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#F59E0B", fontSize: 10 }}
                tickFormatter={(v: number) => formatRs(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#EF4444", fontSize: 10 }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
              />
              <ReferenceLine x={mape} yAxisId="left" stroke="#14B8A6" strokeWidth={2} strokeDasharray="5 5" label={{ value: `Current: ${mape}%`, position: "top", fill: "#14B8A6", fontSize: 10 }} />
              <ReferenceLine x={breakevenMAPE} yAxisId="left" stroke="#8B5CF6" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: "Breakeven", position: "top", fill: "#8B5CF6", fontSize: 9 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v: string) => <span className="text-xs text-[#64748B]">{v}</span>} />
              <Line yAxisId="left" type="monotone" dataKey="expiryWaste" name="Expiry Waste Rs" stroke="#F59E0B" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="stockoutEvents" name="Stockout Events" stroke="#EF4444" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-red-50/20 border border-red-200 rounded-lg p-4">
            <p className="text-xs text-[#64748B] mb-1">At {mape}% MAPE (Current)</p>
            <p className="text-sm text-[#0F172A]">
              <span className="text-amber-400 font-bold">{formatRs(currentPoint.expiryWaste)}</span> expiry waste + <span className="text-red-400 font-bold">{currentPoint.stockoutEvents.toLocaleString()}</span> stockout events
            </p>
          </div>
          <div className="bg-green-50/20 border border-green-200 rounded-lg p-4">
            <p className="text-xs text-[#64748B] mb-1">At 15% MAPE (Target)</p>
            <p className="text-sm text-[#0F172A]">
              <span className="text-amber-400 font-bold">{formatRs(target15Point.expiryWaste)}</span> expiry + <span className="text-red-400 font-bold">{target15Point.stockoutEvents.toLocaleString()}</span> events
            </p>
            <p className="text-xs text-green-400 font-semibold mt-1">
              Saving: {formatRs(currentPoint.expiryWaste - target15Point.expiryWaste)} + {(currentPoint.stockoutEvents - target15Point.stockoutEvents).toLocaleString()} events avoided
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ───── TOOL 3: Pre-Positioning ROI Calculator ─────
function PrePositioningROICalculator() {
  const sim = useMemo(() => getSimulationData(), []);

  const [safetyDays, setSafetyDays] = useState(60);
  const [storageCost, setStorageCost] = useState(850);
  const [capitalCost, setCapitalCost] = useState(12);

  const roiData = useMemo(() => {
    const points: { days: number; cost: number; savings: number; net: number }[] = [];

    const avgBlackoutDays = (81 + 69 + 86) / 3;
    const baseStockoutCost = (sim.overallMetrics.totalPatientOOPRs + sim.overallMetrics.totalEmergencyPremiumRs + sim.overallMetrics.totalDelayedSurgeryCostRs) / 3;

    for (let d = 15; d <= 120; d += 5) {
      const criticalSKUs = sim.skus.filter(s => s.category === "CRITICAL");
      const totalPrePositionUnits = criticalSKUs.reduce(
        (s, sku) => s + sku.avgDailyConsumption * d, 0
      );
      const totalPrePositionValue = criticalSKUs.reduce(
        (s, sku) => s + sku.avgDailyConsumption * d * sku.contractPriceRs, 0
      );

      const storageM2 = totalPrePositionUnits * 0.002; // rough estimate
      const annualStorageCost = storageM2 * storageCost * 12;
      const annualCapitalCost = totalPrePositionValue * (capitalCost / 100);
      const totalCost = annualStorageCost + annualCapitalCost;

      const effectiveness = Math.min(0.95, (d / avgBlackoutDays) * 0.80);
      const savings = baseStockoutCost * effectiveness;
      const net = savings - totalCost;

      points.push({ days: d, cost: totalCost, savings, net });
    }
    return points;
  }, [sim, storageCost, capitalCost]);

  const currentPoint = useMemo(() => {
    return roiData.find(d => d.days === safetyDays) || roiData[0];
  }, [roiData, safetyDays]);

  const optimalDays = useMemo(() => {
    let maxNet = -Infinity;
    let optimal = 60;
    roiData.forEach(d => {
      if (d.net > maxNet) {
        maxNet = d.net;
        optimal = d.days;
      }
    });
    return optimal;
  }, [roiData]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-accent" />
          Pre-Positioning ROI Calculator
        </CardTitle>
        <p className="text-sm text-[#64748B]">
          Is it worth stocking up before fiscal year-end?
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Slider
            min={15}
            max={120}
            step={5}
            value={safetyDays}
            onChange={setSafetyDays}
            label="Safety Stock Days"
            formatValue={(v) => `${v} days`}
          />
          <Slider
            min={400}
            max={1500}
            step={50}
            value={storageCost}
            onChange={setStorageCost}
            label="Storage Cost (Rs/m²/month)"
            formatValue={(v) => `Rs ${v}`}
          />
          <Slider
            min={6}
            max={20}
            step={1}
            value={capitalCost}
            onChange={setCapitalCost}
            label="Working Capital Cost (%/yr)"
            formatValue={(v) => `${v}%`}
          />
        </div>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={roiData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F099" />
              <XAxis
                dataKey="days"
                tick={{ fill: "#64748B", fontSize: 10 }}
                label={{ value: "Safety Stock Days", position: "bottom", fill: "#64748B", fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 10 }}
                tickFormatter={(v: number) => formatRs(v)}
              />
              <ReferenceLine x={safetyDays} stroke="#14B8A6" strokeWidth={2} strokeDasharray="5 5" />
              <ReferenceLine x={optimalDays} stroke="#22C55E" strokeDasharray="3 3" label={{ value: `Optimal: ${optimalDays}d`, position: "top", fill: "#22C55E", fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v: string) => <span className="text-xs text-[#64748B]">{v}</span>} />
              <Bar dataKey="cost" name="Pre-Positioning Cost" fill="#EF4444" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" name="Avoided Costs" fill="#22C55E" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="net" name="Net Benefit" stroke="#14B8A6" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className={`rounded-lg p-3 border ${currentPoint.net > 0 ? "border-green-200 bg-green-50/10" : "border-red-200 bg-red-50/10"}`}>
            <p className="text-xs text-[#64748B]">Net Annual Benefit</p>
            <p className={`text-lg font-bold ${currentPoint.net > 0 ? "text-green-400" : "text-red-400"}`}>
              {formatRs(currentPoint.net)}
            </p>
          </div>
          <div className="rounded-lg p-3 border border-[#E2E8F0] bg-[#F8FAFC]">
            <p className="text-xs text-[#64748B]">Pre-Positioning Cost</p>
            <p className="text-lg font-bold text-red-400">{formatRs(currentPoint.cost)}</p>
          </div>
          <div className="rounded-lg p-3 border border-[#E2E8F0] bg-[#F8FAFC]">
            <p className="text-xs text-[#64748B]">Avoided Costs</p>
            <p className="text-lg font-bold text-green-400">{formatRs(currentPoint.savings)}</p>
          </div>
          <div className="rounded-lg p-3 border border-accent/20 bg-teal-50">
            <p className="text-xs text-[#64748B]">Optimal Safety Stock</p>
            <p className="text-lg font-bold text-accent">{optimalDays} days</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ───── MAIN PAGE ─────
export default function DecisionToolsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Decision Support Tools"
        subtitle="Three standalone interactive calculators that produce actionable outputs for hospital management"
        badge="Actionable Intelligence"
      />

      <BlackoutSurvivalPlanner />
      <ForecastErrorCalculator />
      <PrePositioningROICalculator />
    </div>
  );
}
