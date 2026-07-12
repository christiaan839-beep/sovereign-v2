"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Target, MapPin, Zap } from "lucide-react";

export default function WhiteLabelKPIGrid({
  clientId,
  primaryColor,
}: {
  clientId: string;
  primaryColor: string;
}) {
  const [metrics, setMetrics] = useState({
    leadConversations: 0,
    seoPages: 0,
    socialPosts: 0,
    totalActions: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // /api/portal/metrics requires a signed portal token (wave 122)
        // whose sub matches the clientId; forward the one on the link.
        const token =
          new URLSearchParams(window.location.search).get("token") ?? "";
        const res = await fetch(
          `/api/portal/metrics?tenantId=${encodeURIComponent(clientId)}&token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (data.success) setMetrics(data.metrics);
      } catch {
        // Metrics unavailable — show empty state
      }
    };
    fetchMetrics();
  }, [clientId]);

  const kpis = [
    {
      label: "Active Lead Conversations",
      value: metrics.leadConversations.toLocaleString(),
      trend: "Live",
    },
    {
      label: "Social Posts Generated",
      value: metrics.socialPosts.toLocaleString(),
      trend: "Live",
    },
    {
      label: "SEO Pages Rendered",
      value: metrics.seoPages.toLocaleString(),
      trend: "Live Deployment",
    },
    {
      label: "Autonomous Actions",
      value: metrics.totalActions.toLocaleString(),
      trend: "All Time",
    },
  ];

  const icons = [MessageCircle, Target, MapPin, Zap];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {kpis.map((stat, i) => {
        const Icon = icons[i];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-black/40 backdrop-blur-xl p-5 border border-white/10 rounded-2xl relative overflow-hidden group shadow-xl"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Icon className="w-20 h-20" style={{ color: primaryColor }} />
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border"
              style={{
                backgroundColor: `${primaryColor}15`,
                borderColor: `${primaryColor}30`,
              }}
            >
              <Icon className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
              {stat.label}
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold font-mono text-white">
                {stat.value}
              </span>
              <span className="text-[10px]" style={{ color: primaryColor }}>
                {stat.trend}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
