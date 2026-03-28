"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Building2, Users, Plus, DollarSign, TrendingDown,
  Palette, Globe, X, CheckCircle2, AlertCircle,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  domain: string;
  status: "active" | "onboarding" | "churned";
  mrr: number;
}

const INITIAL_CLIENTS: Client[] = [
  { id: "1", name: "Apex Marketing Co", domain: "apexmktg.com", status: "active", mrr: 4500 },
  { id: "2", name: "Nova Digital", domain: "novadigital.io", status: "active", mrr: 3200 },
  { id: "3", name: "Brightpath Agency", domain: "brightpath.co", status: "onboarding", mrr: 2800 },
  { id: "4", name: "Zenith Solutions", domain: "zenithsol.com", status: "active", mrr: 5100 },
  { id: "5", name: "Lunar Labs", domain: "lunarlabs.dev", status: "churned", mrr: 0 },
];

const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  active: { dot: "bg-emerald-500", text: "text-emerald-400", label: "Active" },
  onboarding: { dot: "bg-amber-500", text: "text-amber-400", label: "Onboarding" },
  churned: { dot: "bg-red-500", text: "text-red-400", label: "Churned" },
};

export default function AgencyHubPage() {
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [showModal, setShowModal] = useState(false);
  const [brandName, setBrandName] = useState("Sovereign Matrix");
  const [brandColor, setBrandColor] = useState("#00B7FF");
  const [brandDomain, setBrandDomain] = useState("sovereign.agency");
  const [brandLogo, setBrandLogo] = useState("https://sovereign.agency/logo.png");

  // Add client form
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newMrr, setNewMrr] = useState("");

  const activeClients = clients.filter((c) => c.status === "active").length;
  const totalMrr = clients.filter((c) => c.status !== "churned").reduce((s, c) => s + c.mrr, 0);
  const churnRate = clients.length > 0 ? ((clients.filter((c) => c.status === "churned").length / clients.length) * 100).toFixed(1) : "0";

  const addClient = () => {
    if (!newName || !newDomain) return;
    const client: Client = {
      id: Date.now().toString(),
      name: newName,
      domain: newDomain,
      status: "onboarding",
      mrr: Number(newMrr) || 0,
    };
    setClients((prev) => [client, ...prev]);
    setNewName("");
    setNewDomain("");
    setNewMrr("");
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-10" role="main" aria-label="Agency hub white-label control center">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Agency Hub</h1>
              <p className="text-sm text-neutral-500">White-label control center</p>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all cursor-pointer">
            <Plus className="w-4 h-4" /> Add Client
          </motion.button>
        </div>
      </motion.div>

      {/* Revenue Overview */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Monthly Recurring Revenue", value: `$${totalMrr.toLocaleString()}`, icon: DollarSign },
          { label: "Active Clients", value: activeClients, icon: Users },
          { label: "Churn Rate", value: `${churnRate}%`, icon: TrendingDown },
        ].map((stat, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <stat.icon className="w-4 h-4 text-neutral-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-600">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Brand Settings */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Palette className="w-4 h-4 text-neutral-400" /> Brand Settings
          </h2>
          <div className="space-y-4">
            {[
              { label: "Company Name", value: brandName, set: setBrandName },
              { label: "Logo URL", value: brandLogo, set: setBrandLogo },
              { label: "Domain", value: brandDomain, set: setBrandDomain },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-600 mb-1.5">{field.label}</label>
                <input value={field.value} onChange={(e) => field.set(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20 transition-colors" />
              </div>
            ))}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-600 mb-1.5">Primary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                <span className="text-sm text-neutral-300 font-mono">{brandColor}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Client List */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-neutral-400" /> Client Portfolio
          </h2>
          <div className="space-y-3">
            {clients.map((client, index) => {
              const style = STATUS_STYLES[client.status];
              return (
                <motion.div key={client.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <Globe className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{client.name}</p>
                      <p className="text-[11px] text-neutral-500 font-mono">{client.domain}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-white">{client.mrr > 0 ? `$${client.mrr.toLocaleString()}` : "--"}</p>
                      <p className="text-[10px] text-neutral-600">MRR</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/[0.06]">
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      <span className={`text-[10px] font-medium ${style.text}`}>{style.label}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Add Client Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" /> Add Client
                </h2>
                <button onClick={() => setShowModal(false)} aria-label="Close add client dialog" className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: "Client Name", value: newName, set: setNewName, placeholder: "Acme Agency" },
                  { label: "Domain", value: newDomain, set: setNewDomain, placeholder: "acme.agency" },
                  { label: "Monthly MRR ($)", value: newMrr, set: setNewMrr, placeholder: "3000" },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">{field.label}</label>
                    <input value={field.value} onChange={(e) => field.set(e.target.value)} placeholder={field.placeholder}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
                  </div>
                ))}
              </div>
              <div className="p-6 border-t border-white/[0.06] flex items-center justify-end gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer">Cancel</button>
                <button onClick={addClient}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all cursor-pointer">
                  Add Client
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
