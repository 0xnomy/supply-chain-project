"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Shield, Download, RotateCcw
} from "lucide-react";
import Link from "next/link";
import { getSimulationData } from "@/lib/simulation/dataEngine";
import { formatRs } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

// ───── TOOL: Blackout Survival Planner ─────
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
          <Shield className="w-5 h-5 text-red-500" />
          Blackout Survival Planner
        </CardTitle>
        <p className="text-sm text-[#64748B]">
          A practical procurement list to bridge the 2-3 month fiscal year-end freeze.
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

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-[#E2E8F0] rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#F8FAFC] z-10">
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left py-3 px-4 text-[#64748B] font-semibold text-xs border-r border-[#E2E8F0]">SKU</th>
                <th className="text-right py-3 px-4 text-[#64748B] font-semibold text-xs border-r border-[#E2E8F0]">Current Stock</th>
                <th className="text-right py-3 px-4 text-[#64748B] font-semibold text-xs border-r border-[#E2E8F0]">Days Cover</th>
                <th className="text-center py-3 px-4 text-[#64748B] font-semibold text-xs border-r border-[#E2E8F0]">Run Out?</th>
                <th className="text-right py-3 px-4 text-[#64748B] font-semibold text-xs border-r border-[#E2E8F0]">Shortfall</th>
                <th className="text-right py-3 px-4 text-[#64748B] font-semibold text-xs">Recommended Order</th>
              </tr>
            </thead>
            <tbody>
              {plannerData.map(d => (
                <tr key={d.id} className={`border-b border-[#E2E8F0] ${d.willRunOut ? "bg-red-50/20" : "hover:bg-slate-50/50"}`}>
                  <td className="py-2.5 px-4 text-xs font-medium text-[#0F172A] border-r border-[#E2E8F0]">{d.name}</td>
                  <td className="py-2.5 px-4 text-right text-xs text-[#64748B] border-r border-[#E2E8F0] font-mono">{d.currentStock}</td>
                  <td className="py-2.5 px-4 text-right text-xs border-r border-[#E2E8F0] font-mono">
                    <span className={d.daysOfCover < blackoutDays ? "text-red-500 font-bold" : "text-teal-600 font-bold"}>
                      {d.daysOfCover}d
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center border-r border-[#E2E8F0]">
                    {d.willRunOut ? (
                      <Badge variant="danger" className="text-[9px] font-bold">YES</Badge>
                    ) : (
                      <Badge variant="success" className="text-[9px] font-bold">NO</Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right text-xs text-red-500 font-mono border-r border-[#E2E8F0]">{d.shortfall > 0 ? d.shortfall : "—"}</td>
                  <td className="py-2.5 px-4 text-right text-xs text-teal-600 font-bold font-mono">{d.preOrderQty > 0 ? d.preOrderQty : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between mt-6 pt-6 border-t border-[#E2E8F0] gap-6">
          <div className="flex gap-8">
            <div className="bg-red-50 px-6 py-4 rounded-2xl border border-red-100">
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Pre-Positioning Budget</p>
              <p className="text-3xl font-mono font-black text-[#0F172A]">{formatRs(totals.totalCost)}</p>
            </div>
            <div className="bg-teal-50 px-6 py-4 rounded-2xl border border-teal-100">
              <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1">Storage Required</p>
              <p className="text-3xl font-mono font-black text-[#0F172A]">{totals.storageEstimate} m²</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-5 bg-[#0F172A] text-white rounded-2xl text-lg font-bold hover:bg-slate-800 shadow-xl transition-all active:scale-95"
          >
            <Download className="w-5 h-5" />
            Download Order List
          </button>
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
        subtitle="Operational outputs for hospital management to act on simulation insights."
        badge="Practical Intelligence"
      />

      <div className="bg-teal-50 border-l-4 border-teal-500 p-5 rounded-r-lg mb-8 flex items-start gap-4">
        <div className="text-teal-500 text-xl font-bold mt-1">ℹ️</div>
        <p className="text-[15px] text-teal-800 leading-relaxed font-medium">
          <span className="font-bold uppercase tracking-wider block mb-1">SO WHAT? FROM INSIGHT TO ACTION</span>
          The simulation showed that a 90-day supply gap is creating the crisis. Use this tool to generate the exact <span className="font-bold">Order List</span> needed to survive the upcoming fiscal year-end freeze. Export this list to share with the Procurement Department.
        </p>
      </div>

      <BlackoutSurvivalPlanner />

      <div className="mt-12 mb-8 flex justify-center">
        <Link href="/" className="inline-flex items-center gap-3 px-8 py-5 bg-white border-2 border-[#E2E8F0] text-[#0F172A] rounded-2xl text-lg font-bold hover:bg-slate-50 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
          <RotateCcw className="w-6 h-6" />
          Back to the Crisis Overview
        </Link>
      </div>
    </div>
  );
}
