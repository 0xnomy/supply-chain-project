"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  ComposedChart, BarChart, Bar, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import {
  Wrench, DollarSign,
  ArrowDownRight, RotateCcw, Zap, ShieldCheck,
  Clock, Calculator, FileText, Package, ArrowRight,
} from "lucide-react";
import { computeScenario, DEFAULT_SCENARIO } from "@/lib/simulation/scenarioEngine";
import type { ScenarioConfig } from "@/lib/simulation/types";
import { formatRs, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; stroke?: string; fill?: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-[#0F172A] font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || entry.stroke || entry.fill }}>
          {entry.name}: {typeof entry.value === "number" && Math.abs(entry.value) > 1000
            ? formatRs(entry.value) : Math.round(entry.value)}
        </p>
      ))}
    </div>
  );
}

const interventionIcons = [Package, Zap, Calculator, ShieldCheck, Clock];
const interventionColors = ["#3B82F6", "#8B5CF6", "#14B8A6", "#F59E0B", "#22C55E"];

type ViewMode = "expiry" | "stockout" | "oopCost" | "budget";

export default function ScenarioLabPage() {

  const [config, setConfig] = useState<ScenarioConfig>({ ...DEFAULT_SCENARIO });
  const [viewMode, setViewMode] = useState<ViewMode>("expiry");

  const updateConfig = useCallback((update: Partial<ScenarioConfig>) => {
    setConfig(prev => ({ ...prev, ...update }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig({ ...DEFAULT_SCENARIO });
  }, []);

  const scenario = useMemo(() => computeScenario(config), [config]);

  // Comparison data for KPI cards
  const kpiData = useMemo(() => ({
    expiry: {
      baseline: scenario.baseline.annualExpiryWasteRs,
      projected: scenario.projectedAnnual.expiryWasteRs,
    },
    stockout: {
      baseline: scenario.baseline.annualStockoutRate,
      projected: scenario.projectedAnnual.stockoutRate,
    },
    oopEvents: {
      baseline: scenario.baseline.annualPatientOOPRs / 1200,
      projected: scenario.projectedAnnual.patientOOPRs / 1200,
    },
    emergency: {
      baseline: scenario.baseline.annualEmergencyPremiumRs,
      projected: scenario.projectedAnnual.emergencyPremiumRs,
    },
  }), [scenario]);

  // Comparison chart data
  const comparisonData = useMemo(() => {
    return scenario.monthlyProjection.map(m => ({
      month: m.month,
      "Baseline Expiry": m.baselineExpiryRs,
      "Projected Expiry": m.projectedExpiryRs,
      "Baseline Stockout": m.baselineStockoutDays,
      "Projected Stockout": m.projectedStockoutDays,
    }));
  }, [scenario]);

  // Waterfall chart data
  const waterfallData = useMemo(() => {
    const baseline = scenario.baseline.annualExpiryWasteRs +
      scenario.baseline.annualEmergencyPremiumRs +
      scenario.baseline.annualPatientOOPRs +
      scenario.baseline.annualDelayedSurgeryRs;

    const items: { name: string; value: number; type: "start" | "reduction" | "end"; color: string }[] = [
      { name: "Baseline Total", value: baseline, type: "start", color: "#EF4444" },
    ];

    const enabledInterventions = scenario.interventions.filter(iv => iv.enabled && iv.totalAnnualSavingsRs > 0);
    enabledInterventions.forEach((iv) => {
      items.push({
        name: iv.name.split(" ").slice(0, 2).join(" "),
        value: -iv.totalAnnualSavingsRs,
        type: "reduction",
        color: interventionColors[scenario.interventions.indexOf(iv)] || "#22C55E",
      });
    });

    const projected = scenario.projectedAnnual.expiryWasteRs +
      scenario.projectedAnnual.emergencyPremiumRs +
      scenario.projectedAnnual.patientOOPRs +
      scenario.projectedAnnual.delayedSurgeryRs;

    items.push({
      name: "Projected Total",
      value: projected,
      type: "end",
      color: "#14B8A6",
    });

    // Calculate waterfall positions
    let cumulative = baseline;
    return items.map(item => {
      if (item.type === "start") {
        return { ...item, start: 0, end: item.value, displayValue: item.value };
      } else if (item.type === "end") {
        return { ...item, start: 0, end: item.value, displayValue: item.value };
      } else {
        const start = cumulative;
        cumulative += item.value;
        return { ...item, start: cumulative, end: start, displayValue: item.value };
      }
    });
  }, [scenario]);

  // 5-year ROI
  const roiData = useMemo(() => scenario.fiveYearROI, [scenario]);

  const enabledCount = scenario.interventions.filter(iv => iv.enabled).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Fix It: Scenario Testing"
        subtitle="Toggle interventions and see real-time financial impact. This is the decision-making tool for hospital management."
        badge="Interactive Scenario Lab"
      />

      <div className="bg-white border-2 border-teal-500 rounded-2xl p-6 mb-8 shadow-xl shadow-teal-500/10 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <p className="text-sm font-bold text-teal-600 uppercase tracking-widest mb-1">Headline Result</p>
          <h2 className="text-2xl md:text-3xl font-black text-[#0F172A] leading-tight">
            {enabledCount > 0 ? (
              <>
                With <span className="text-teal-600">{enabledCount}</span> interventions, annual waste drops from 
                <span className="text-red-500 line-through ml-2">Rs 1.39B</span> to 
                <span className="text-teal-600 ml-2 font-mono">Rs {((scenario.projectedAnnual.expiryWasteRs + scenario.projectedAnnual.emergencyPremiumRs + scenario.projectedAnnual.patientOOPRs + scenario.projectedAnnual.delayedSurgeryRs) / 1000000000).toFixed(2)}B</span>
              </>
            ) : (
              <>
                Baseline annual waste stands at <span className="text-red-500 ml-2">Rs 1.39B</span>. Toggle interventions below.
              </>
            )}
          </h2>
        </div>
        <div className="bg-teal-600 text-white px-6 py-4 rounded-xl text-center min-w-[180px]">
          <p className="text-xs font-bold uppercase opacity-80 mb-1">Total Saving</p>
          <p className="text-2xl font-mono font-black">{formatRs(scenario.projectedAnnual.totalSavingsRs)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ─── LEFT: Control Panel ─── */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-accent" />
                  Active Interventions
                </span>
                <Badge variant="default">{enabledCount}/5</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Intervention 1: Pre-Positioning */}
              <div className={`rounded-lg border p-3 transition-all ${config.prePositioningSafetyDays > 7 ? "border-blue-200 bg-blue-50/20" : "border-[#E2E8F0]"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-[#0F172A]">Pre-Positioning</span>
                  </div>
                  <Badge variant={config.prePositioningSafetyDays > 7 ? "success" : "outline"} className="text-[8px]">
                    {config.prePositioningSafetyDays > 7 ? "ON" : "OFF"}
                  </Badge>
                </div>
                <p className="text-[10px] text-[#64748B] mb-2">Buy a safety buffer right before the budget freeze starts (July 1st)</p>
                <Slider
                  min={7}
                  max={120}
                  step={5}
                  value={config.prePositioningSafetyDays}
                  onChange={(v) => updateConfig({ prePositioningSafetyDays: v })}
                  label="Safety Stock Days"
                  formatValue={(v) => v === 7 ? "Off" : `${v} days`}
                />
                {config.prePositioningSafetyDays > 7 && (
                  <p className="text-[9px] text-blue-400 mt-1">CAPEX: Rs 12M | OPEX: Rs 2.4M/yr</p>
                )}
              </div>

              {/* Intervention 2: FIFO Enforcement */}
              <div className={`rounded-lg border p-3 transition-all ${config.fifoEnforced ? "border-purple-200 bg-purple-50/20" : "border-[#E2E8F0]"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-semibold text-[#0F172A]">FIFO Enforcement</span>
                  </div>
                  <Switch checked={config.fifoEnforced} onCheckedChange={(v) => updateConfig({ fifoEnforced: v })} />
                </div>
                <p className="text-[10px] text-[#64748B]">Force staff to grab the oldest medicine off the shelf first using RFID</p>
                {config.fifoEnforced && (
                  <p className="text-[9px] text-purple-400 mt-1">CAPEX: Rs 3.8M | OPEX: Rs 0.9M/yr</p>
                )}
              </div>

              {/* Intervention 3: Consumption-Based Reorder */}
              <div className={`rounded-lg border p-3 transition-all ${config.consumptionBasedReorder ? "border-teal-200 bg-teal-50/20" : "border-[#E2E8F0]"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-3.5 h-3.5 text-teal-400" />
                    <span className="text-xs font-semibold text-[#0F172A]">Consumption Reorder</span>
                  </div>
                  <Switch checked={config.consumptionBasedReorder} onCheckedChange={(v) => updateConfig({ consumptionBasedReorder: v })} />
                </div>
                <p className="text-[10px] text-[#64748B]">Auto-order based on what patients actually use, instead of manually guessing</p>
                {config.consumptionBasedReorder && (
                  <p className="text-[9px] text-teal-400 mt-1">CAPEX: Rs 2.1M | OPEX: Rs 0.6M/yr</p>
                )}
              </div>

              {/* Intervention 4: Emergency Framework */}
              <div className={`rounded-lg border p-3 transition-all ${config.emergencyFrameworkEnabled ? "border-amber-200 bg-amber-50/20" : "border-[#E2E8F0]"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-[#0F172A]">Emergency Framework</span>
                  </div>
                  <Switch checked={config.emergencyFrameworkEnabled} onCheckedChange={(v) => updateConfig({ emergencyFrameworkEnabled: v })} />
                </div>
                <p className="text-[10px] text-[#64748B]">Pre-approve regular suppliers so we don&apos;t pay 35% extra during panics</p>
                {config.emergencyFrameworkEnabled && (
                  <p className="text-[9px] text-amber-400 mt-1">CAPEX: Rs 0.4M | OPEX: Rs 0.15M/yr</p>
                )}
              </div>

              {/* Intervention 5: Advance Budget */}
              <div className={`rounded-lg border p-3 transition-all ${config.advanceBudgetRequest ? "border-green-200 bg-green-50/20" : "border-[#E2E8F0]"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs font-semibold text-[#0F172A]">Advance Budget</span>
                  </div>
                  <Switch checked={config.advanceBudgetRequest} onCheckedChange={(v) => updateConfig({ advanceBudgetRequest: v })} />
                </div>
                <p className="text-[10px] text-[#64748B]">Ask government for money 45 days early to shrink the 90-day delay</p>
                {config.advanceBudgetRequest && (
                  <p className="text-[9px] text-green-400 mt-1">CAPEX: Rs 0.2M | OPEX: Rs 0.08M/yr</p>
                )}
              </div>

              <button
                onClick={resetConfig}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] hover:text-[#0F172A] hover:bg-white transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Baseline
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ─── RIGHT: Dashboard ─── */}
        <div className="lg:col-span-3 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Expiry Waste */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs text-[#64748B] mb-1">Annual Expiry Waste</p>
              <p className="text-sm text-gray-500 line-through">{formatRs(kpiData.expiry.baseline)}</p>
              <p className="text-xl font-bold text-[#0F172A]">{formatRs(kpiData.expiry.projected)}</p>
              {kpiData.expiry.projected < kpiData.expiry.baseline && (
                <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                  <ArrowDownRight className="w-3 h-3" />
                  −{formatRs(kpiData.expiry.baseline - kpiData.expiry.projected)} ({formatPercent(((kpiData.expiry.baseline - kpiData.expiry.projected) / kpiData.expiry.baseline) * 100, 0)})
                </p>
              )}
            </div>

            {/* Stockout Rate */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs text-[#64748B] mb-1">Critical Stockout Rate</p>
              <p className="text-sm text-gray-500 line-through">{formatPercent(kpiData.stockout.baseline, 1)}</p>
              <p className="text-xl font-bold text-[#0F172A]">{formatPercent(kpiData.stockout.projected, 1)}</p>
              {kpiData.stockout.projected < kpiData.stockout.baseline && (
                <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                  <ArrowDownRight className="w-3 h-3" />
                  −{formatPercent(kpiData.stockout.baseline - kpiData.stockout.projected, 1)} points
                </p>
              )}
            </div>

            {/* Patient OOP */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs text-[#64748B] mb-1">Patient OOP Events/yr</p>
              <p className="text-sm text-gray-500 line-through">{Math.round(kpiData.oopEvents.baseline).toLocaleString()}</p>
              <p className="text-xl font-bold text-[#0F172A]">{Math.round(kpiData.oopEvents.projected).toLocaleString()}</p>
              {kpiData.oopEvents.projected < kpiData.oopEvents.baseline && (
                <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                  <ArrowDownRight className="w-3 h-3" />
                  −{Math.round(kpiData.oopEvents.baseline - kpiData.oopEvents.projected).toLocaleString()} events
                </p>
              )}
            </div>

            {/* Emergency Premium */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs text-[#64748B] mb-1">Emergency Premium/yr</p>
              <p className="text-sm text-gray-500 line-through">{formatRs(kpiData.emergency.baseline)}</p>
              <p className="text-xl font-bold text-[#0F172A]">{formatRs(kpiData.emergency.projected)}</p>
              {kpiData.emergency.projected < kpiData.emergency.baseline && (
                <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                  <ArrowDownRight className="w-3 h-3" />
                  −{formatRs(kpiData.emergency.baseline - kpiData.emergency.projected)}
                </p>
              )}
            </div>
          </div>

          {/* Comparison Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Baseline vs. Intervention Impact</CardTitle>
                <div className="flex gap-2">
                  {(["expiry", "stockout"] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        viewMode === mode
                          ? "bg-accent/20 text-accent border border-accent/30"
                          : "bg-white text-[#64748B] border border-[#E2E8F0]"
                      }`}
                    >
                      {mode === "expiry" ? "Expiry Waste" : "Stockout Days"}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] min-h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={comparisonData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F099" />
                    <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 9 }} interval={2} angle={-45} textAnchor="end" height={50} />
                    <YAxis
                      tick={{ fill: "#64748B", fontSize: 10 }}
                      tickFormatter={viewMode === "expiry" ? (v: number) => formatRs(v) : undefined}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={(v: string) => <span className="text-xs text-[#64748B]">{v}</span>} />
                    {viewMode === "expiry" ? (
                      <>
                        <Area type="monotone" dataKey="Baseline Expiry" stroke="#EF4444" strokeOpacity={0.3} fill="#EF4444" fillOpacity={0.1} strokeDasharray="5 5" />
                        <Area type="monotone" dataKey="Projected Expiry" stroke="#14B8A6" strokeWidth={2} fill="#14B8A6" fillOpacity={0.15} />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="Baseline Stockout" fill="#EF4444" fillOpacity={0.3} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Projected Stockout" fill="#14B8A6" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Waterfall Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" />
                Cost Waterfall: Baseline → Projected Annual Cost
              </CardTitle>
              <p className="text-xs text-[#64748B]">
                How each intervention reduces total annual avoidable cost
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] min-h-[280px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F099" />
                    <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 10 }} tickFormatter={(v: number) => formatRs(v)} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-2xl text-xs">
                          <p className="text-[#0F172A] font-semibold">{d.name}</p>
                          <p className={d.type === "reduction" ? "text-green-400" : d.type === "start" ? "text-red-400" : "text-accent"}>
                            {d.type === "reduction" ? "Saving: " : ""}{formatRs(Math.abs(d.displayValue))}
                          </p>
                        </div>
                      );
                    }} />
                    {/* Invisible base bar */}
                    <Bar dataKey="start" stackId="waterfall" fill="transparent" />
                    {/* Visible bar */}
                    <Bar dataKey={(d: any) => Math.abs(d.end - d.start)} stackId="waterfall" radius={[4, 4, 0, 0]}>
                      {waterfallData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payback Analysis Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                Payback Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-3 px-3 text-[#64748B] font-medium">Intervention</th>
                      <th className="text-right py-3 px-3 text-[#64748B] font-medium">CAPEX</th>
                      <th className="text-right py-3 px-3 text-[#64748B] font-medium">OPEX/yr</th>
                      <th className="text-right py-3 px-3 text-[#64748B] font-medium">Annual Saving</th>
                      <th className="text-right py-3 px-3 text-[#64748B] font-medium">Payback</th>
                      <th className="text-center py-3 px-3 text-[#64748B] font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.interventions.map((iv, i) => (
                      <tr key={iv.name} className={`border-b border-[#E2E8F0] transition-colors ${iv.enabled ? "bg-teal-50" : ""}`}>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {React.createElement(interventionIcons[i], { className: `w-3.5 h-3.5`, style: { color: interventionColors[i] } })}
                            <span className="text-xs font-medium text-[#0F172A]">{iv.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-xs text-[#64748B]">{iv.implementationCostRs > 0 ? formatRs(iv.implementationCostRs) : "—"}</td>
                        <td className="py-3 px-3 text-right text-xs text-[#64748B]">{iv.ongoingOpexRs > 0 ? formatRs(iv.ongoingOpexRs) : "—"}</td>
                        <td className="py-3 px-3 text-right text-xs font-semibold text-green-400">
                          {iv.totalAnnualSavingsRs > 0 ? formatRs(iv.totalAnnualSavingsRs) : "—"}
                        </td>
                        <td className="py-3 px-3 text-right text-xs text-accent">
                          {iv.paybackMonths > 0 ? `${iv.paybackMonths.toFixed(1)} months` : "—"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant={iv.enabled ? "success" : "outline"} className="text-[9px]">
                            {iv.enabled ? "ENABLED" : "OFF"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-accent/30 bg-teal-50">
                      <td className="py-3 px-3 font-bold text-accent text-xs">Combined Portfolio</td>
                      <td className="py-3 px-3 text-right text-xs font-bold text-[#0F172A]">{formatRs(scenario.projectedAnnual.totalImplementationRs)}</td>
                      <td className="py-3 px-3 text-right text-xs font-bold text-[#0F172A]">{formatRs(scenario.projectedAnnual.totalOngoingOpexRs)}</td>
                      <td className="py-3 px-3 text-right text-xs font-bold text-green-400">{formatRs(scenario.projectedAnnual.totalSavingsRs)}</td>
                      <td className="py-3 px-3 text-right text-xs font-bold text-accent">
                        {scenario.projectedAnnual.paybackMonths > 0 ? `${scenario.projectedAnnual.paybackMonths.toFixed(1)} months` : "—"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant="success" className="text-[9px]">{enabledCount} ACTIVE</Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                <p className="text-xs text-[#64748B]">
                  <span className="text-accent font-semibold">The Bottom Line:</span> By spending <span className="font-semibold text-red-500">{formatRs(scenario.projectedAnnual.totalImplementationRs + scenario.projectedAnnual.totalOngoingOpexRs)}</span> per year on these interventions, the hospital avoids <span className="font-semibold text-green-500">{formatRs(scenario.projectedAnnual.totalSavingsRs)}</span> in absolute waste. This makes the net financial benefit to the system <span className="text-green-500 font-semibold">{formatRs(scenario.projectedAnnual.netAnnualBenefitRs)}</span>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 5-Year ROI */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">5-Year ROI Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] min-h-[250px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roiData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F099" />
                    <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 10 }} tickFormatter={(v: number) => formatRs(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={(v: string) => <span className="text-xs text-[#64748B]">{v}</span>} />
                    <Bar dataKey="investmentRs" name="Investment" fill="#EF4444" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="savingsRs" name="Savings" fill="#22C55E" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cumulativeNetRs" name="Cumulative Net" fill="#14B8A6" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-16 mb-8 flex justify-center">
        <Link href="/decision-tools" className="inline-flex items-center gap-3 px-12 py-6 bg-teal-600 text-white rounded-2xl text-xl font-bold hover:bg-teal-700 shadow-xl hover:shadow-teal-600/40 transition-all hover:scale-[1.05] active:scale-[0.95]">
          Next Step: See the Decision Tools 
          <ArrowRight className="w-8 h-8" />
        </Link>
      </div>
    </div>
  );
}
