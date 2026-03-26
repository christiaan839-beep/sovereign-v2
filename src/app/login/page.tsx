"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, Loader2, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true); setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isLogin ? "login" : "signup", email, password }),
      });
      const data = await res.json();
      
      if (data.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Authentication failed.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-gradient-radial from-electric/10 via-transparent to-transparent blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md">
        
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-electric to-rose-glow flex items-center justify-center text-xs font-bold text-white">U</div>
            <span className="text-sm font-semibold tracking-[0.15em] uppercase text-white">SOVEREIGN</span>
          </Link>
          <h1 className="text-3xl font-light serif-text text-white tracking-wide">
            {isLogin ? "Access Intelligence" : "Deploy Intelligence"}
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            {isLogin ? "Sign in to your command center" : "Create your master account"}
          </p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-2 block">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-onyx border border-glass-border rounded-xl p-3 text-sm text-white focus:outline-none focus:border-electric/50 transition-colors"
                placeholder="admin@umbra.ai"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-2 block">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-onyx border border-glass-border rounded-xl p-3 text-sm text-white focus:outline-none focus:border-electric/50 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <div className="text-xs text-red-400 font-medium px-2">{error}</div>}

            <button 
              type="submit" 
              disabled={loading || !email || !password}
              className="w-full py-3.5 mt-2 bg-white text-midnight font-bold rounded-xl hover:bg-gray-200 transition-gpu disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isLogin ? <LogIn className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              {loading ? "Authenticating..." : isLogin ? "Sign In" : "Create Account"}
              {!loading && <ArrowRight className="w-4 h-4 ml-1 opacity-50 group-hover:translate-x-1 transition-gpu" />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-xs text-text-secondary hover:text-white transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
