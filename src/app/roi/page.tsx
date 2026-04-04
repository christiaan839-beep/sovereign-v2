"use client";

import React, { useState } from "react";
import { Calculator, DollarSign, ArrowRight, TrendingUp, Clock, Users, Zap } from "lucide-react";

export default function ROICalculatorPage() {
  const [leads, setLeads] = useState(100);
  const [hours, setHours] = useState(40);
  const [employees, setEmployees] = useState(3);
  const [avgDeal, setAvgDeal] = useState(5000);

  const hourlyRate = 350;
  const currentCost = employees * hours * 4 * hourlyRate;
  const sovereignCost = 24997;
  const savings = currentCost - sovereignCost;
  const leadIncrease = Math.round(leads * 3.4);
  const revenueIncrease = Math.round(leadIncrease * 0.15 * avgDeal);
  const hoursRecovered = Math.round(hours * 0.85);
  const roi = Math.round(((revenueIncrease + savings) / sovereignCost) * 100);

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-8 font-mono">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-4 pb-8 border-b border-neutral-800">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00ff66]/10 border border-[#00ff66]/30 text-[#00ff66] text-[10px] font-bold uppercase tracking-widest">
            <Calculator className="w-3 h-3" /> ROI Calculator
          </div>
          <h1 className="text-3xl font-black uppercase tracking-[0.15em]">How Much Will You <span className="text-[#00ff66]">Save</span>?</h1>
          <p className="text-neutral-500 text-sm max-w-lg mx-auto">Enter your current metrics. See exactly how Sovereign Matrix impacts your bottom line.</p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Your Current Operations</h2>
            {[
              { label: "Monthly leads generated", value: leads, set: setLeads, max: 1000, icon: Users },
              { label: "Hours/week on marketing", value: hours, set: setHours, max: 80, icon: Clock },
              { label: "Marketing team size", value: employees, set: setEmployees, max: 20, icon: Users },
              { label: "Average deal value (ZAR)", value: avgDeal, set: setAvgDeal, max: 100000, icon: DollarSign },
            ].map(item => (
              <div key={item.label} className="bg-neutral-950 border border-neutral-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-neutral-400 flex items-center gap-2">
                    <item.icon className="w-3 h-3" /> {item.label}
                  </label>
                  <span className="text-sm font-black text-white">{item.value.toLocaleString()}</span>
                </div>
                <input type="range" min={1} max={item.max} value={item.value} onChange={e => item.set(Number(e.target.value))} className="w-full accent-[#00B7FF] h-1" />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">With Sovereign Matrix</h2>
            <div className="bg-[#00ff66]/5 border border-[#00ff66]/20 p-6 text-center">
              <p className="text-[10px] text-[#00ff66] uppercase tracking-widest mb-2">Monthly ROI</p>
              <p className="text-5xl font-black text-[#00ff66]">{roi}%</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-950 border border-neutral-800 p-4 text-center">
                <TrendingUp className="w-4 h-4 text-[#00B7FF] mx-auto mb-2" />
                <p className="text-lg font-black text-[#00B7FF]">{leadIncrease.toLocaleString()}</p>
                <p className="text-[8px] text-neutral-500 uppercase tracking-widest">Leads/Month</p>
              </div>
              <div className="bg-neutral-950 border border-neutral-800 p-4 text-center">
                <DollarSign className="w-4 h-4 text-[#00ff66] mx-auto mb-2" />
                <p className="text-lg font-black text-[#00ff66]">R{(savings > 0 ? savings : 0).toLocaleString()}</p>
                <p className="text-[8px] text-neutral-500 uppercase tracking-widest">Monthly Savings</p>
              </div>
              <div className="bg-neutral-950 border border-neutral-800 p-4 text-center">
                <Clock className="w-4 h-4 text-[#A855F7] mx-auto mb-2" />
                <p className="text-lg font-black text-[#A855F7]">{hoursRecovered}h</p>
                <p className="text-[8px] text-neutral-500 uppercase tracking-widest">Hours Recovered/Week</p>
              </div>
              <div className="bg-neutral-950 border border-neutral-800 p-4 text-center">
                <Zap className="w-4 h-4 text-[#FF6B00] mx-auto mb-2" />
                <p className="text-lg font-black text-[#FF6B00]">R{revenueIncrease.toLocaleString()}</p>
                <p className="text-[8px] text-neutral-500 uppercase tracking-widest">Added Revenue/Month</p>
              </div>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-500"><span>Current monthly cost</span><span className="text-red-400 font-bold">R{currentCost.toLocaleString()}</span></div>
              <div className="flex justify-between text-neutral-500"><span>Sovereign Matrix cost</span><span className="text-[#00ff66] font-bold">R{sovereignCost.toLocaleString()}</span></div>
              <div className="border-t border-neutral-800 pt-2 flex justify-between font-bold text-white"><span>Net monthly impact</span><span className="text-[#00ff66]">+R{(revenueIncrease + (savings > 0 ? savings : 0)).toLocaleString()}</span></div>
            </div>
            <a href="/pricing" className="block w-full py-4 bg-white text-black font-bold text-sm uppercase tracking-widest text-center hover:bg-neutral-200 transition-gpu">
              View Plans <ArrowRight className="w-4 h-4 inline ml-2" />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
