"use client";

import React, { useState, useEffect } from "react";
import { Trophy, Zap, Clock, BarChart3, RefreshCcw, Loader2, Crown } from "lucide-react";

interface BenchmarkResult {
  model: string;
  model_id: string;
  duration_ms: number;
  tokens_per_second: number;
  word_count: number;
  output_preview: string;
  status: string;
}

interface LeaderboardEntry {
  model: string;
  wins: number;
  avg_speed_ms: number;
  avg_throughput: number;
  runs: number;
  rank: number;
}

export default function LeaderboardPage() {
  const [running, setRunning] = useState(false);
  const [prompt, setPrompt] = useState("Write a 100-word analysis of how AI will transform South African businesses in 2026.");
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([
    { model: "DeepSeek V3.2", wins: 0, avg_speed_ms: 0, avg_throughput: 0, runs: 0, rank: 1 },
    { model: "Mistral Nemotron", wins: 0, avg_speed_ms: 0, avg_throughput: 0, runs: 0, rank: 2 },
    { model: "GLM 4.7", wins: 0, avg_speed_ms: 0, avg_throughput: 0, runs: 0, rank: 3 },
  ]);
  const [winner, setWinner] = useState<string | null>(null);

  const runBenchmark = async () => {
    setRunning(true);
    setWinner(null);

    const res = await fetch("/api/agents/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();

    if (data.benchmarks) {
      setBenchmarks(data.benchmarks);
      setWinner(data.winners?.fastest || null);

      // Update leaderboard
      setLeaderboard(prev => prev.map(entry => {
        const result = data.benchmarks.find((b: BenchmarkResult) => b.model === entry.model);
        if (!result || result.status !== "✅ Success") return entry;

        const newRuns = entry.runs + 1;
        return {
          ...entry,
          runs: newRuns,
          wins: entry.wins + (result.model === data.winners?.fastest ? 1 : 0),
          avg_speed_ms: Math.round((entry.avg_speed_ms * entry.runs + result.duration_ms) / newRuns),
          avg_throughput: Math.round((entry.avg_throughput * entry.runs + result.tokens_per_second) / newRuns),
        };
      }).sort((a, b) => b.wins - a.wins || a.avg_speed_ms - b.avg_speed_ms)
        .map((e, i) => ({ ...e, rank: i + 1 })));
    }

    setRunning(false);
  };

  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const rankIcons = [Crown, Trophy, Trophy];

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 font-mono">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-[#FFD700]/20 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#FFD700]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-[0.2em]">AI Agent Leaderboard</h1>
              <p className="text-[#FFD700]/60 text-xs uppercase tracking-widest">Live Model Benchmarking · Speed · Throughput · Quality</p>
            </div>
          </div>
        </header>

        {/* Leaderboard Table */}
        <div className="bg-neutral-950 border border-neutral-800 overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-[#FFD700] via-[#C0C0C0] to-[#CD7F32]" />
          <table className="w-full">
            <thead>
              <tr className="text-[9px] text-neutral-500 uppercase tracking-widest border-b border-neutral-800">
                <th className="p-4 text-left">Rank</th>
                <th className="p-4 text-left">Model</th>
                <th className="p-4 text-center">Wins</th>
                <th className="p-4 text-center">Avg Speed</th>
                <th className="p-4 text-center">Throughput</th>
                <th className="p-4 text-center">Runs</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => {
                const RankIcon = rankIcons[i] || Trophy;
                return (
                  <tr key={entry.model} className={`border-b border-neutral-900 ${winner === entry.model ? "bg-[#FFD700]/5" : ""}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <RankIcon className="w-4 h-4" style={{ color: rankColors[i] || "#666" }} />
                        <span className="font-black" style={{ color: rankColors[i] || "#666" }}>#{entry.rank}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-bold text-white">{entry.model}</span>
                      {winner === entry.model && <span className="ml-2 text-[9px] text-[#FFD700] uppercase tracking-widest">⚡ Latest Winner</span>}
                    </td>
                    <td className="p-4 text-center text-emerald-400 font-bold">{entry.wins}</td>
                    <td className="p-4 text-center text-[#00B7FF] font-bold">{entry.avg_speed_ms ? `${entry.avg_speed_ms}ms` : "—"}</td>
                    <td className="p-4 text-center text-[#A855F7] font-bold">{entry.avg_throughput ? `${entry.avg_throughput} t/s` : "—"}</td>
                    <td className="p-4 text-center text-neutral-500">{entry.runs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Run Benchmark */}
        <div className="bg-neutral-950 border border-neutral-800 p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Run New Benchmark</h2>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-black border border-neutral-800 px-4 py-3 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 font-mono resize-none"
          />
          <button
            onClick={runBenchmark}
            disabled={running}
            className="w-full py-3 bg-[#FFD700] text-black font-bold text-sm uppercase tracking-widest hover:bg-[#FFD700]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Benchmarking 3 Models...</> : <><Zap className="w-4 h-4" /> Run Benchmark</>}
          </button>
        </div>

        {/* Latest Results */}
        {benchmarks.length > 0 && (
          <div className="grid md:grid-cols-3 gap-4">
            {benchmarks.map((b, i) => (
              <div key={b.model} className={`bg-neutral-950 border p-5 space-y-3 ${b.model === winner ? "border-[#FFD700]/50" : "border-neutral-800"}`}>
                {b.model === winner && <div className="h-[2px] bg-[#FFD700] -mt-5 -mx-5 mb-3" />}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">{b.model}</h3>
                  <span className={`text-[9px] uppercase tracking-widest ${b.status.includes("✅") ? "text-emerald-400" : "text-red-400"}`}>{b.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div><p className="text-lg font-black text-[#00B7FF]">{b.duration_ms}ms</p><p className="text-[8px] text-neutral-600">Speed</p></div>
                  <div><p className="text-lg font-black text-[#A855F7]">{b.tokens_per_second}</p><p className="text-[8px] text-neutral-600">Tokens/sec</p></div>
                </div>
                <p className="text-[10px] text-neutral-600 leading-relaxed">{b.output_preview?.substring(0, 120)}...</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
