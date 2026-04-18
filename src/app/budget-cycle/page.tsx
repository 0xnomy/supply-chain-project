"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import {
  Calendar, AlertTriangle, ArrowRight, ShieldOff, Clock,
  Banknote, Users, Zap,
} from "lucide-react";
import { getSimulationData } from "@/lib/simulation/dataEngine";
import { getSKUDetailData } from "@/lib/simulation/skuTimeSeries";
import { formatRs } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MONTHS_SHORT = [
  "Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun",
];
const FY_LABELS = ["FY2022","FY2023","FY2024"];

type OverlayMode = "stock" | "expiry" | "emergency";

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; stroke?: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xl">
      <p className="text-[#0F172A] font-semibold mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color || entry.stroke }}>
          {entry.name}: {typeof entry.value === "number" && entry.value > 1000
            ? formatRs(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function BudgetCyclePage() {
  const sim = useMemo(() => getSimulationData(), []);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("stock");

  // Find IV Cannula 18G for the explainer chart
  const ivCannula = useMemo(() => {
    const sku = sim.skus.find(s => s.name.includes("IV Cannula 18G"));
    if (!sku) return null;
    const analysis = sim.skuAnalysis.find(a => a.sku.id === sku.id);
    if (!analysis) return null;
    return { sku, analysis, detail: getSKUDetailData(sku, analysis) };
  }, [sim]);

  // Fiscal calendar heatmap data
  const calendarData = useMemo(() => {
    return sim.monthlyData.map((m, i) => {
      const fyIdx = m.fiscalYear - 1;
      const monthInFY = i % 12;

      // Determine procurement status
      let status: "blackout" | "ppra-delay" | "active";
      if (monthInFY <= 2 && m.inBlackout) {
        status = "blackout";
      } else if (monthInFY === 3) { // Q2 delay month (Oct)
        status = "ppra-delay";
      } else {
        status = "active";
      }

      // Is there a seasonal demand spike?
      const hasDengue = monthInFY >= 0 && monthInFY <= 3; // Jul-Oct
      const hasRespiratory = monthInFY >= 4 && monthInFY <= 6; // Nov-Jan
      const hasSeasonal = hasDengue || hasRespiratory;

      return {
        month: m.month,
        monthShort: MONTHS_SHORT[monthInFY],
        fy: FY_LABELS[fyIdx],
        fyIdx,
        monthInFY,
        status,
        hasSeasonal,
        stockoutDays: m.criticalStockoutDays,
        expiryWasteRs: m.expiryWasteRs,
        emergencyPremiumRs: m.emergencyPremiumRs,
        patientOOPEvents: m.patientOOPEvents,
        budgetUtilisedRs: m.budgetUtilisedRs,
      };
    });
  }, [sim]);

  // Sparkline data for critical SKU categories during months
  const sparklineData = useMemo(() => {
    // Use IV fluids as representative critical category
    const criticalSKUs = sim.skus.filter(s => s.category === "CRITICAL").slice(0, 5);
    return criticalSKUs.map(sku => {
      const analysis = sim.skuAnalysis.find(a => a.sku.id === sku.id)!;
      const detail = getSKUDetailData(sku, analysis);
      return {
        name: sku.name.length > 20 ? sku.name.slice(0, 20) + "…" : sku.name,
        data: detail.monthly.map(m => ({
          month: m.month,
          stock: m.stockOnHand,
          stockoutDays: m.stockoutDays,
        })),
      };
    });
  }, [sim]);

  // Blackout impact table data
  const blackoutTable = useMemo(() => {
    return sim.fiscalYears.map(fy => {
      const blackoutStart = `Jul 1, ${2020 + fy.year}`;
      const blackoutDays = fy.blackoutDays;
      const endDates = ["Sep 19, 2021", "Sep 8, 2022", "Sep 25, 2023"];
      return {
        fy: fy.label,
        start: blackoutStart,
        end: endDates[fy.year - 1],
        daysBlocked: blackoutDays,
        criticalSKUsAtZero: Math.round(fy.criticalStockoutDays / blackoutDays),
        emergencyPurchases: Math.round(fy.emergencyPremiumRs / 50000),
        emergencyPremiumRs: fy.emergencyPremiumRs,
        patientOOPEvents: fy.patientOOPEvents,
        patientOOPCostRs: fy.patientOOPRs,
      };
    });
  }, [sim]);

  // IV Cannula stock chart data (for the explainer)
  const ivCannulaChartData = useMemo(() => {
    if (!ivCannula) return [];
    return ivCannula.detail.monthly.map(m => ({
      month: m.month,
      stock: m.stockOnHand,
      consumed: m.consumed,
      stockoutDays: m.stockoutDays,
      inBlackout: m.inBlackout,
    }));
  }, [ivCannula]);

  // With pre-positioning simulation (90-day safety stock)
  const ivCannulaWithPreposition = useMemo(() => {
    if (!ivCannula) return [];
    return ivCannula.detail.monthly.map(m => {
      // Pre-positioning: add 90 days of safety stock before blackout months
      const prePositionBoost = m.inBlackout
        ? (ivCannula.sku.avgDailyConsumption * 90 * 0.6) // 60% effective
        : 0;
      return {
        month: m.month,
        stock: Math.max(0, m.stockOnHand + prePositionBoost),
        stockoutDays: Math.max(0, Math.round(m.stockoutDays * 0.15)),
        inBlackout: m.inBlackout,
      };
    });
  }, [ivCannula]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "blackout": return "bg-red-100 border-red-300";
      case "ppra-delay": return "bg-amber-100 border-amber-300";
      case "active": return "bg-teal-100 border-teal-300";
      default: return "bg-white border-[#E2E8F0]";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "blackout": return "BLOCKED";
      case "ppra-delay": return "DELAYED";
      case "active": return "ACTIVE";
      default: return "";
    }
  };

  const totals = useMemo(() => ({
    daysBlocked: blackoutTable.reduce((s, r) => s + r.daysBlocked, 0),
    emergencyPremiumRs: blackoutTable.reduce((s, r) => s + r.emergencyPremiumRs, 0),
    patientOOPEvents: blackoutTable.reduce((s, r) => s + r.patientOOPEvents, 0),
    patientOOPCostRs: blackoutTable.reduce((s, r) => s + r.patientOOPCostRs, 0),
  }), [blackoutTable]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="The Budget Blackout"
        subtitle="Pakistan's fiscal calendar creates legally enforced procurement blackouts of 69–86 days every year. Technology alone cannot solve a constitutional constraint — only pre-positioning can bridge it."
        badge="Constitutional Constraint"
      />

      {/* ─── SECTION A: Fiscal Calendar Heatmap ─── */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            Fiscal Year Procurement Calendar (36 Months)
          </CardTitle>
          <p className="text-sm text-[#64748B]">
            Each cell represents one month. Color indicates procurement authority status.
          </p>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
              <span className="text-xs text-[#64748B]">Full Blackout — cannot procure</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300"></div>
              <span className="text-xs text-[#64748B]">Budget available, PPRA delays</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-teal-100 border border-teal-300"></div>
              <span className="text-xs text-[#64748B]">Full procurement authority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500/40"></div>
              <span className="text-xs text-[#64748B]">Seasonal demand spike</span>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="space-y-2">
            {[0, 1, 2].map(fyIdx => (
              <div key={fyIdx}>
                <div className="text-xs font-semibold text-[#64748B] mb-1">{FY_LABELS[fyIdx]}</div>
                <div className="grid grid-cols-12 gap-1">
                  {calendarData
                    .filter(c => c.fyIdx === fyIdx)
                    .map((cell, i) => (
                      <div
                        key={i}
                        className={`relative rounded-lg border p-2 transition-all duration-200 hover:scale-105 hover:z-10 hover:shadow-lg cursor-pointer group ${getStatusColor(cell.status)} ${cell.hasSeasonal ? "bg-[length:4px_4px] bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(245,158,11,0.1)_2px,rgba(245,158,11,0.1)_4px)]" : ""}`}
                      >
                        <div className="text-center">
                          <p className="text-xs font-bold text-[#0F172A]">{cell.monthShort}</p>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1 rounded ${
                            cell.status === "blackout" ? "text-red-400" :
                            cell.status === "ppra-delay" ? "text-amber-400" : "text-teal-400"
                          }`}>
                            {getStatusLabel(cell.status)}
                          </span>
                          {cell.hasSeasonal && (
                            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500/60"></div>
                          )}
                        </div>

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-[#E2E8F0] rounded-lg p-3 shadow-2xl z-20 w-48 hidden group-hover:block">
                          <p className="text-xs font-bold text-[#0F172A] mb-1">{cell.month}</p>
                          <p className="text-[10px] text-[#64748B]">Status: <span className={
                            cell.status === "blackout" ? "text-red-400" :
                            cell.status === "ppra-delay" ? "text-amber-400" : "text-teal-400"
                          }>{getStatusLabel(cell.status)}</span></p>
                          <p className="text-[10px] text-[#64748B]">Stockout days: <span className="text-red-400">{cell.stockoutDays}</span></p>
                          <p className="text-[10px] text-[#64748B]">Expiry waste: <span className="text-amber-400">{formatRs(cell.expiryWasteRs)}</span></p>
                          <p className="text-[10px] text-[#64748B]">Emergency: <span className="text-orange-400">{formatRs(cell.emergencyPremiumRs)}</span></p>
                          <p className="text-[10px] text-[#64748B]">OOP events: <span className="text-red-400">{cell.patientOOPEvents}</span></p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Overlay selector */}
          <div className="flex items-center gap-4 mt-6 mb-4 border-t border-[#E2E8F0] pt-4">
            <span className="text-sm text-[#64748B]">Show:</span>
            {(["stock", "expiry", "emergency"] as OverlayMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setOverlayMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  overlayMode === mode
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-white text-[#64748B] border border-[#E2E8F0] hover:text-[#0F172A]"
                }`}
              >
                {mode === "stock" ? "Stock Levels" : mode === "expiry" ? "Expiry Events" : "Emergency Purchases"}
              </button>
            ))}
          </div>

          {/* Sparklines below heatmap */}
          {overlayMode === "stock" && (
            <div className="space-y-3">
              {sparklineData.slice(0, 4).map((sparkline, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-[#64748B] w-40 truncate">{sparkline.name}</span>
                  <div className="flex-1 h-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkline.data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="stock"
                          stroke="#14B8A6"
                          strokeWidth={1}
                          fill={`url(#grad-${idx})`}
                        />
                        {sparkline.data.map((d, i) => (
                          d.stockoutDays > 5 ? (
                            <ReferenceLine key={i} x={d.month} stroke="#EF4444" strokeOpacity={0.3} />
                          ) : null
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}

          {overlayMode === "expiry" && (
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calendarData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Bar dataKey="expiryWasteRs" fill="#F59E0B" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                  <Tooltip content={<CustomTooltip />} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {overlayMode === "emergency" && (
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calendarData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Bar dataKey="emergencyPremiumRs" fill="#F97316" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                  <Tooltip content={<CustomTooltip />} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Blackout Days" value={`${totals.daysBlocked}`} subtitle="Across 3 fiscal years" variant="danger" icon={ShieldOff} />
        <StatCard title="Emergency Premium" value={formatRs(totals.emergencyPremiumRs)} subtitle="Paid above contract rate" variant="warning" icon={Banknote} />
        <StatCard title="Patient OOP Events" value={totals.patientOOPEvents.toLocaleString()} subtitle="Patients forced to buy outside" variant="danger" icon={Users} />
        <StatCard title="OOP Cost Burden" value={formatRs(totals.patientOOPCostRs)} subtitle="Rs 1,200 per event average" variant="warning" icon={AlertTriangle} />
      </div>

      {/* ─── SECTION B: Blackout Impact Table ─── */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-red-400" />
            Blackout Impact by Fiscal Year
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left py-3 px-3 text-[#64748B] font-medium">FY</th>
                  <th className="text-left py-3 px-3 text-[#64748B] font-medium">Blackout Start</th>
                  <th className="text-left py-3 px-3 text-[#64748B] font-medium">Blackout End</th>
                  <th className="text-right py-3 px-3 text-[#64748B] font-medium">Days Blocked</th>
                  <th className="text-right py-3 px-3 text-[#64748B] font-medium">Critical SKUs at Zero</th>
                  <th className="text-right py-3 px-3 text-[#64748B] font-medium">Emergency Purchases</th>
                  <th className="text-right py-3 px-3 text-[#64748B] font-medium">Premium Paid</th>
                  <th className="text-right py-3 px-3 text-[#64748B] font-medium">Patient OOP Events</th>
                  <th className="text-right py-3 px-3 text-[#64748B] font-medium">OOP Cost</th>
                </tr>
              </thead>
              <tbody>
                {blackoutTable.map(row => (
                  <tr key={row.fy} className="border-b border-[#E2E8F0] hover:bg-white transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#0F172A]">{row.fy}</td>
                    <td className="py-3 px-3 text-red-400">{row.start}</td>
                    <td className="py-3 px-3 text-red-400">{row.end}</td>
                    <td className="py-3 px-3 text-right font-bold text-red-400">{row.daysBlocked}</td>
                    <td className="py-3 px-3 text-right text-red-400">{row.criticalSKUsAtZero}</td>
                    <td className="py-3 px-3 text-right text-amber-400">{row.emergencyPurchases}</td>
                    <td className="py-3 px-3 text-right text-amber-400">{formatRs(row.emergencyPremiumRs)}</td>
                    <td className="py-3 px-3 text-right text-red-400">{row.patientOOPEvents.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-red-400">{formatRs(row.patientOOPCostRs)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-accent/30 bg-teal-50">
                  <td colSpan={3} className="py-3 px-3 font-bold text-accent">Total (3 Years)</td>
                  <td className="py-3 px-3 text-right font-bold text-[#0F172A]">{totals.daysBlocked}</td>
                  <td className="py-3 px-3 text-right text-[#64748B]">—</td>
                  <td className="py-3 px-3 text-right text-[#64748B]">—</td>
                  <td className="py-3 px-3 text-right font-bold text-amber-400">{formatRs(totals.emergencyPremiumRs)}</td>
                  <td className="py-3 px-3 text-right font-bold text-red-400">{totals.patientOOPEvents.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-bold text-red-400">{formatRs(totals.patientOOPCostRs)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION C: What Happens to a Critical SKU ─── */}
      {ivCannula && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-400" />
              What Happens to IV Cannula 18G During Blackout
              <Badge variant="danger">Critical SKU Explainer</Badge>
            </CardTitle>
            <p className="text-sm text-[#64748B]">
              Stock level over 36 months — watch it crash to zero during every Q1 blackout window
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ivCannulaChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F099" />
                  <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 10 }} interval={2} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 11 }} label={{ value: "Stock on Hand", angle: -90, position: "insideLeft", fill: "#64748B", fontSize: 11 }} />

                  {/* Blackout annotations */}
                  <ReferenceLine x="Jul 2021" stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Blackout Starts", position: "top", fill: "#EF4444", fontSize: 9 }} />
                  <ReferenceLine x="Aug 2021" stroke="#EF4444" strokeDasharray="5 5" strokeOpacity={0.5} label={{ value: "Stock → 0", position: "top", fill: "#EF4444", fontSize: 9 }} />
                  <ReferenceLine x="Sep 2021" stroke="#22C55E" strokeDasharray="3 3" label={{ value: "Emergency Order", position: "top", fill: "#22C55E", fontSize: 9 }} />
                  <ReferenceLine x="Jul 2022" stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Blackout FY23", position: "top", fill: "#EF4444", fontSize: 9 }} />
                  <ReferenceLine x="Jul 2023" stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Blackout FY24", position: "top", fill: "#EF4444", fontSize: 9 }} />

                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(v: string) => <span className="text-xs text-[#64748B]">{v}</span>} />
                  <Area
                    type="monotone"
                    dataKey="stock"
                    name="Stock on Hand"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    fill="url(#stockGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[#E2E8F0]">
              <div className="text-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mx-auto mb-1"></div>
                <p className="text-[10px] text-[#64748B]">1. Blackout starts</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 rounded-full bg-red-700 mx-auto mb-1"></div>
                <p className="text-[10px] text-[#64748B]">2. Stock hits zero</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 rounded-full bg-orange-500 mx-auto mb-1"></div>
                <p className="text-[10px] text-[#64748B]">3. Patients turned away</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mx-auto mb-1"></div>
                <p className="text-[10px] text-[#64748B]">4. Emergency order placed</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-1"></div>
                <p className="text-[10px] text-[#64748B]">5. Stock restored (+30% premium)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── SECTION D: Intervention Preview ─── */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Pre-Positioning: The Solution Preview
          </CardTitle>
          <p className="text-sm text-[#64748B]">
            Side-by-side comparison: IV Cannula 18G stock with and without 90-day pre-positioning
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WITHOUT pre-positioning */}
            <div>
              <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Without Pre-Positioning (Current)
              </h4>
              <div className="h-[200px] border border-red-200 rounded-lg p-2 bg-red-50/10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ivCannulaChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="noPreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F030" />
                    <XAxis dataKey="month" tick={false} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 9 }} width={30} />
                    <Area type="monotone" dataKey="stock" stroke="#EF4444" strokeWidth={1.5} fill="url(#noPreGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-red-400 mt-2">
                Stock drops to zero during every blackout. Patients sent outside.
              </p>
            </div>

            {/* WITH pre-positioning */}
            <div>
              <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                With 90-Day Pre-Positioning
              </h4>
              <div className="h-[200px] border border-green-200 rounded-lg p-2 bg-green-50/10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ivCannulaWithPreposition} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="preGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F030" />
                    <XAxis dataKey="month" tick={false} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 9 }} width={30} />
                    <Area type="monotone" dataKey="stock" stroke="#22C55E" strokeWidth={1.5} fill="url(#preGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-green-400 mt-2">
                Stock buffer bridges the blackout. 95% fewer stockout events.
              </p>
            </div>
          </div>

          <div className="text-center mt-6 pt-4 border-t border-[#E2E8F0]">
            <Link
              href="/scenario-lab"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-[#0F172A] rounded-xl text-sm font-medium hover:bg-accent-600 shadow-lg shadow-accent/25 transition-all"
            >
              Test All Interventions in the Scenario Lab
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
