"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceArea, ReferenceLine, BarChart,
} from "recharts";
import {
  AlertTriangle, TrendingDown, Calculator, ShieldAlert, Scale,
  ArrowRight, Skull, Package, Banknote, Clock, Users,
} from "lucide-react";
import { getSimulationData } from "@/lib/simulation/dataEngine";
import { formatRs, formatPercent } from "@/lib/utils";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Custom tooltip for crisis timeline
function CrisisTimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xl">
      <p className="text-[#0F172A] font-semibold mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.name.includes("Rs") ? formatRs(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

function FinancialTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xl">
      <p className="text-[#0F172A] font-semibold mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatRs(entry.value)}
        </p>
      ))}
    </div>
  );
}

const rootCauseCards = [
  {
    icon: Calculator,
    title: "Manual Forecasting",
    description: "Pharmacists predict demand manually on paper. Guessing too high causes expiry waste; guessing too low causes patient stockouts.",
    severity: "High",
    href: "/scenario-lab",
    variant: "warning" as const,
  },
  {
    icon: Package,
    title: "Bulk Procurement Breakdown",
    description: "The hospital buys a year's supply in 3 massive batches. Buying massive chunks of medicine when patients need them daily creates a structural mismatch.",
    severity: "High",
    href: "/scenario-lab",
    variant: "warning" as const,
  },
  {
    icon: TrendingDown,
    title: "Shelf Management (LIFO)",
    description: "Staff grab whatever medicine is at the front of the shelf because it's easier. Older batches hide at the back until they expire.",
    severity: "Medium",
    href: "/scenario-lab",
    variant: "warning" as const,
  },
  {
    icon: Skull,
    title: "The Budget Blackout",
    description: "The government budget arrives 60–90 days late every year. Purchasing is legally blocked until it arrives, so stock drops to zero.",
    severity: "Critical",
    href: "/budget-cycle",
    variant: "danger" as const,
    isPrimary: true,
  },
  {
    icon: Scale,
    title: "Strict PPRA Rules",
    description: "Government regulations delay large purchases by 3 weeks. The hospital is forced into expensive emergency 'spot buys' that cost 35% more.",
    severity: "High",
    href: "/budget-cycle",
    variant: "warning" as const,
  },
];

export default function CrisisPage() {
  const sim = useMemo(() => getSimulationData(), []);

  // Monthly timeline data for the chart
  const timelineData = useMemo(() => {
    return sim.monthlyData.map((m) => ({
      month: m.month,
      criticalStockoutDays: m.criticalStockoutDays,
      expiryWasteRs: m.expiryWasteRs,
      inBlackout: m.inBlackout,
    }));
  }, [sim]);

  // Fiscal year financial data
  const financialData = useMemo(() => {
    return sim.fiscalYears.map((fy) => ({
      year: fy.label,
      "Expiry Waste": fy.expiryWasteRs,
      "Emergency Premium": fy.emergencyPremiumRs,
      "Patient OOP": fy.patientOOPRs,
      "Delayed Surgery": fy.delayedSurgeryCostRs,
    }));
  }, [sim]);

  // Compute blackout reference areas
  const blackoutAreas = useMemo(() => {
    const areas: { x1: string; x2: string; label: string }[] = [];
    // FY2022 blackout: Jul 2021 - Sep 2021
    areas.push({ x1: "Jul 2021", x2: "Sep 2021", label: "Q1 Blackout FY22" });
    // FY2023 blackout: Jul 2022 - Sep 2022
    areas.push({ x1: "Jul 2022", x2: "Sep 2022", label: "Q1 Blackout FY23" });
    // FY2024 blackout: Jul 2023 - Sep 2023
    areas.push({ x1: "Jul 2023", x2: "Sep 2023", label: "Q1 Blackout FY24" });
    return areas;
  }, []);

  // Seasonal reference lines
  const seasonalLines = useMemo(() => [
    { x: "Aug 2021", label: "Dengue", color: "#F59E0B" },
    { x: "Nov 2021", label: "Respiratory", color: "#3B82F6" },
    { x: "Aug 2022", label: "Dengue", color: "#F59E0B" },
    { x: "Apr 2022", label: "Ramadan", color: "#8B5CF6" },
    { x: "Nov 2022", label: "Respiratory", color: "#3B82F6" },
    { x: "Aug 2023", label: "Dengue", color: "#F59E0B" },
    { x: "Mar 2023", label: "Ramadan", color: "#8B5CF6" },
    { x: "Nov 2023", label: "Respiratory", color: "#3B82F6" },
    { x: "Mar 2024", label: "Ramadan", color: "#8B5CF6" },
  ], []);

  const avgStockoutRate = sim.overallMetrics.avgCriticalStockoutRate;
  const avgExpiryRate = sim.overallMetrics.avgExpiryRate;

  return (
    <div className="grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ─── NEW SECTION A: Academic Attribution Banner (Premium Redesign) ─── */}
        <div className="mb-14 overflow-hidden rounded-3xl border border-teal-200 bg-white shadow-2xl shadow-teal-900/5">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Project & Course Info */}
            <div className="lg:col-span-8 p-8 md:p-12 bg-gradient-to-br from-teal-50/50 to-white">
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-teal-600 text-white font-bold text-xs px-3 py-1.5 rounded-full tracking-wider uppercase">
                  MS-491
                </span>
                <span className="text-teal-700 font-semibold text-sm tracking-wide">
                  Supply Chain Management
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-[1.1] mb-4 tracking-tight">
                Hospital Supply Chain Failure <br className="hidden md:block" />
                Analysis & Simulation
              </h1>

              <p className="text-lg text-slate-600 mb-8 max-w-2xl leading-relaxed">
                A simulation-based solution to <span className="text-teal-600 font-semibold">Problem 14</span> —
                Critical Item Stockouts, Expiry Waste & Government Budget Cycle Mismatch.
              </p>

              <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-0.5">Submitted To</p>
                  <p className="text-sm font-semibold text-slate-700">Mr. Hassan Tariq | School of Management Sciences, GIKI</p>
                </div>
              </div>
            </div>

            {/* Right: The Team */}
            <div className="lg:col-span-4 bg-slate-50 border-l border-teal-100 p-8 md:p-10 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  Developed By
                </h3>

                <div className="space-y-6">
                  {[
                    { name: "Hassan Rais", id: "2022212" },
                    { name: "Muhammad Adeel", id: "2022331" },
                    { name: "Nauman Ali Murad", id: "2022479" },
                  ].map((student) => (
                    <div key={student.id} className="group">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-teal-600 transition-colors mb-1">
                        {student.name}
                      </p>
                      <p className="text-xs font-mono text-slate-400 tracking-wider">
                        Reg No: {student.id}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 pt-6 border-t border-slate-200">
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  Synthetic simulation calibrated to Problem 14 parameters. No real patient data used.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── NEW SECTION B: Problem Summary ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Left Column: The Problem */}
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              What is happening at Mayo Hospital, Lahore?
            </h2>
            <p className="text-slate-700 leading-relaxed mb-6">
              A 1,200-bed public sector tertiary hospital managing over 8,000 medical SKUs
              faces a deeply paradoxical crisis: critical medicines and surgical supplies run
              out while other items expire unused on the shelf — simultaneously, every year.
              Patients are turned away or sent to buy medicines from outside pharmacies at
              a 35–55% premium. Surgeries are delayed. Rs 648 million of procured medicines
              are thrown away annually — not because of poor purchasing, but because of a
              structural mismatch between when medicines arrive and when they are needed.
            </p>
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <div className="mt-1 flex-shrink-0 text-xl">📦</div>
                <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Bulk procurement</span> driven by government budget tranches, not real demand</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-1 flex-shrink-0 text-xl">🔄</div>
                <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">FIFO policy ignored</span> in practice — older stock expires at the back of shelves</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-1 flex-shrink-0 text-xl">🚫</div>
                <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Legal procurement blackout</span> of 60–90 days at the start of every fiscal year</p>
              </div>
            </div>
          </div>

          {/* Right Column: Our Solution */}
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              How this simulation helps
            </h2>
            <p className="text-slate-700 leading-relaxed mb-6">
              This interactive platform simulates three fiscal years of hospital supply chain
              data — synthetically generated but statistically calibrated to the real problem
              parameters. It lets you see exactly where the system breaks down, quantify the
              financial damage, and test interventions that could fix it.
            </p>
            <div className="space-y-4 mb-8">
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">1</div>
                <p className="text-sm text-slate-600 pt-0.5">Explore the 3-year crisis timeline to see stockouts and expiry spikes together</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">2</div>
                <p className="text-sm text-slate-600 pt-0.5">Analyse the Budget Blackout page to understand the legal procurement constraint</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">3</div>
                <p className="text-sm text-slate-600 pt-0.5">Drill into individual SKUs to see LIFO expiry and forecast error in action</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">4</div>
                <p className="text-sm text-slate-600 pt-0.5">Run the Scenario Lab to test fixes and see their financial impact in real time</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-block bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded">200 SKUs simulated</span>
              <span className="inline-block bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded">3 fiscal years</span>
              <span className="inline-block bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded">5 interventions testable</span>
              <span className="inline-block bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded">Rs 1.39B annual waste</span>
            </div>
          </div>
        </div>

        {/* ─── NEW SECTION: Financial Damage Summary ─── */}
        <div className="bg-red-50/50 rounded-2xl p-8 border border-red-100 shadow-sm mb-12">
          <h3 className="text-xl font-bold mb-6 text-[#0F172A]">Annual Financial Damage Summary</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
              <p className="text-sm text-[#64748B]">Total Expiry Waste</p>
              <p className="text-2xl font-mono font-bold text-red-500">Rs 648M</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
              <p className="text-sm text-[#64748B]">Patient OOP Burden</p>
              <p className="text-2xl font-mono font-bold text-amber-500">Rs 480M</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
              <p className="text-sm text-[#64748B]">Delayed Surgery Cost</p>
              <p className="text-2xl font-mono font-bold text-amber-500">Rs 180M</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
              <p className="text-sm text-[#64748B]">Emergency Premium</p>
              <p className="text-2xl font-mono font-bold text-amber-600">Rs 85M</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between md:items-center bg-white border border-red-200 rounded-xl p-4 gap-4">
            <span className="text-lg text-[#0F172A] font-medium">Total Avoidable System Waste</span>
            <span className="text-3xl font-mono font-bold text-red-600">Rs 1.393B / yr</span>
          </div>
        </div>

        {/* ─── EXISTING SECTION C: Hero Paradox Cards ─── */}
        <div className="mb-12 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0 relative">
            {/* LEFT — Stockout */}
            <div className="rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none border-t border-b border-l border-r md:border-r-0 border-red-200 bg-red-50 p-8 lg:p-10 border-l-4 sm:border-l-red-500">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-sm font-semibold text-red-500 uppercase tracking-wider">
                  Stockout Crisis
                </span>
              </div>
              <p className="text-5xl lg:text-6xl font-black text-red-500 mb-2">
                18.4%
              </p>
              <p className="text-lg text-red-600 font-semibold mb-3">
                Critical item stockout rate
              </p>
              <p className="text-sm text-red-600/80 leading-relaxed">
                480,000 patient prescriptions per year<br />forced to outside pharmacies at premium prices
              </p>
            </div>

            {/* CENTER — connector text */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex">
              <div className="bg-white border border-slate-200 rounded-full px-4 py-2 text-center shadow-lg">
                <p className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  Simultaneously.
                </p>
              </div>
            </div>

            {/* RIGHT — Expiry */}
            <div className="rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none border-b border-t border-l md:border-l-0 border-r border-red-200 bg-red-50 p-8 lg:p-10 border-r-4 sm:border-r-red-500 md:border-l-4 md:border-l-red-500 md:border-r md:border-r-red-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-red-500" />
                <span className="text-sm font-semibold text-red-500 uppercase tracking-wider">
                  Expiry Waste
                </span>
              </div>
              <p className="text-5xl lg:text-6xl font-black text-red-500 mb-2">
                Rs 648M
              </p>
              <p className="text-lg text-red-600 font-semibold mb-3">
                Annual inventory expires unused
              </p>
              <p className="text-sm text-red-600/80 leading-relaxed">
                Procured medicines thrown away on shelves<br />while same items are out-of-stock
              </p>
            </div>
          </div>

          {/* Bottom connector text */}
          <div className="text-center mt-6 md:mt-8">
            <p className="text-lg lg:text-xl text-slate-600 font-medium max-w-2xl mx-auto">
              These happen{" "}
              <span className="text-slate-900 font-bold">simultaneously</span>. In the same
              hospital. Same year.{" "}
              <span className="text-accent font-bold">Here&apos;s why.</span>
            </p>
          </div>
        </div>

        <div className="bg-teal-50 border-l-4 border-teal-500 p-5 rounded-r-lg mb-8 flex items-start gap-4">
          <div className="text-teal-500 text-xl font-bold mt-1">ℹ️</div>
          <p className="text-[15px] text-teal-800 leading-relaxed font-medium">
            <span className="font-bold uppercase tracking-wider block mb-1">Key Insight: The Paradox</span>
            The massive spikes in <span className="font-bold text-red-600">Expiry Waste</span> (red line) consistently occur immediately before or as the <span className="font-bold text-red-400">Budget Blackout</span> (shaded area) hits. The hospital panic-buys massive amounts of excess stock before being legally blocked from purchasing, only for the old stock to expire on shelves while new stock deliveries freeze, simultaneously driving up <span className="font-bold text-[#0F172A]">Stockouts</span> (red bars).
          </p>
        </div>

        {/* ─── SECTION C: 3-Year Crisis Timeline ─── */}
        <div className="mb-12">
          <Card className="bg-white border-[#E2E8F0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0F172A]">
                <TrendingDown className="w-5 h-5 text-accent" />
                3-Year Crisis Timeline
              </CardTitle>
              <p className="text-sm text-[#64748B]">
                Monthly critical stockout-days (bars) vs. expiry waste (line) — July 2021 to June 2024
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[360px] min-h-[360px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.8} />

                    {/* Blackout reference areas */}
                    {blackoutAreas.map((area, i) => (
                      <ReferenceArea
                        key={i}
                        x1={area.x1}
                        x2={area.x2}
                        fill="#EF4444"
                        fillOpacity={0.12}
                        stroke="#EF4444"
                        strokeOpacity={0.15}
                      />
                    ))}

                    {/* Seasonal reference lines */}
                    {seasonalLines.map((line, i) => (
                      <ReferenceLine
                        key={i}
                        x={line.x}
                        stroke={line.color}
                        strokeDasharray="3 3"
                        strokeOpacity={0.4}
                        label={{
                          value: line.label,
                          position: "top",
                          fill: line.color,
                          fontSize: 9,
                        }}
                      />
                    ))}

                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#64748B", fontSize: 10 }}
                      tickLine={{ stroke: "#E2E8F0" }}
                      interval={2}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      tickLine={{ stroke: "#E2E8F0" }}
                      label={{
                        value: "Stockout-days",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#64748B",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      tickLine={{ stroke: "#E2E8F0" }}
                      tickFormatter={(v: number) => formatRs(v)}
                      label={{
                        value: "Expiry Waste (Rs)",
                        angle: 90,
                        position: "insideRight",
                        fill: "#64748B",
                        fontSize: 11,
                      }}
                    />

                    <Tooltip content={<CrisisTimelineTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: "16px" }}
                      formatter={(value: string) => (
                        <span className="text-[#64748B] text-xs">{value}</span>
                      )}
                    />

                    <Bar
                      yAxisId="left"
                      dataKey="criticalStockoutDays"
                      name="Critical Stockout-Days"
                      fill="#EF4444"
                      fillOpacity={0.6}
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="expiryWasteRs"
                      name="Expiry Waste Rs"
                      stroke="#EF4444"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4, fill: "#EF4444" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── EXISTING SECTION E: Where the Money is Going ─── */}
        <div className="mb-12">
          <Card className="bg-white border-[#E2E8F0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0F172A]">
                <Banknote className="w-5 h-5 text-accent" />
                Where the Money is Going
              </CardTitle>
              <p className="text-sm text-[#64748B]">
                Fiscal year breakdown of avoidable costs across four categories
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] min-h-[320px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.8} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      tickFormatter={(v: number) => formatRs(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="year"
                      tick={{ fill: "#0F172A", fontSize: 13, fontWeight: 600 }}
                      width={60}
                    />
                    <Tooltip content={<FinancialTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: "12px" }}
                      formatter={(value: string) => (
                        <span className="text-[#64748B] text-xs">{value}</span>
                      )}
                    />
                    <Bar dataKey="Expiry Waste" fill="#EF4444" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Emergency Premium" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Patient OOP" fill="#F97316" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Delayed Surgery" fill="#EAB308" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Summary Stats Row ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <StatCard
            title="Annual Budget"
            value={formatRs(sim.overallMetrics.annualBudget)}
            subtitle="Total procurement budget per fiscal year"
            variant="accent"
            icon={Banknote}
          />
          <StatCard
            title="Annual Expiry Waste"
            value={formatRs(sim.overallMetrics.totalExpiryWasteRs / 3)}
            subtitle={`${formatPercent(avgExpiryRate, 1)} of procurement budget`}
            variant="danger"
            icon={AlertTriangle}
          />
          <StatCard
            title="Patient OOP Burden"
            value={formatRs(sim.overallMetrics.totalPatientOOPRs / 3)}
            subtitle={`${Math.round(sim.overallMetrics.totalPatientOOPEvents / 3).toLocaleString()} events/year`}
            variant="warning"
            icon={Skull}
          />
          <StatCard
            title="Forecast Error (MAPE)"
            value={formatPercent(sim.overallMetrics.avgMAPE, 0)}
            subtitle="Average pharmacist forecast error"
            variant="warning"
            icon={Calculator}
          />
        </div>

        {/* ─── EXISTING SECTION F: Root Cause Cards ─── */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Root Causes</h2>
          <p className="text-[#64748B] mb-6">
            Five structural mechanisms that create the paradoxical simultaneous stockout + expiry crisis
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {rootCauseCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} href={card.href}>
                  <div
                    className={`group relative rounded-xl border p-5 transition-all duration-300 hover:scale-[1.03] shadow-sm hover:shadow-md cursor-pointer h-full ${card.isPrimary
                      ? "border-red-200 bg-red-50 glow-danger"
                      : "border-[#E2E8F0] bg-white hover:border-accent/30"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={`p-2 rounded-lg ${card.isPrimary
                          ? "bg-red-100"
                          : "bg-accent/10 group-hover:bg-accent/20"
                          }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${card.isPrimary ? "text-red-500" : "text-accent"
                            }`}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${card.severity === "Critical"
                          ? "bg-red-100 text-red-600"
                          : card.severity === "High"
                            ? "bg-amber-100 text-amber-600"
                            : "bg-blue-100 text-blue-600"
                          }`}
                      >
                        {card.severity}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#0F172A] mb-2 group-hover:text-accent transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-[#64748B] leading-relaxed mb-3">
                      {card.description}
                    </p>

                    <div className="flex items-center gap-1 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                      Deep dive <ArrowRight className="w-3 h-3" />
                    </div>

                    {card.isPrimary && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md">
                        PRIMARY
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ─── Call to Action ─── */}
        <div className="text-center py-8 mb-4">
          <div className="inline-flex flex-col items-center">
            <p className="text-[#64748B] mb-4 text-lg">
              Ready to explore the interventions that can fix this?
            </p>
            <div className="flex gap-4">
              <Link
                href="/budget-cycle"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:border-accent/30 shadow-sm transition-all"
              >
                <ShieldAlert className="w-4 h-4" />
                Understand the Root Causes
              </Link>
              <Link
                href="/scenario-lab"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-600 shadow-md shadow-accent/25 transition-all"
              >
                Run Interventions
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ─── NEW SECTION E: Next Step Navigation ─── */}
        <div className="mt-16 mb-8 flex justify-center">
          <Link href="/budget-cycle" className="inline-flex items-center gap-3 px-12 py-6 bg-teal-600 text-white rounded-2xl text-xl font-bold hover:bg-teal-700 shadow-xl hover:shadow-teal-600/40 transition-all hover:scale-[1.05] active:scale-[0.95]">
            Next Step: See the Budget Blackout
            <ArrowRight className="w-8 h-8" />
          </Link>
        </div>
      </div>
    </div>
  );
}
