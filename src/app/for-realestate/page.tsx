"use client";

import {
  Home,
  PenLine,
  PhoneCall,
  TrendingUp,
  Shield,
  Database,
  Layers,
  Zap,
} from "lucide-react";
import {
  VerticalPageShell,
  type VerticalConfig,
} from "@/components/landing/VerticalPageShell";

const config: VerticalConfig = {
  slug: "real-estate",
  label: "Real Estate",
  EyebrowIcon: Home,
  accent: "amber",
  heroLine1: "AI agents for",
  heroHighlight: "real estate.",
  heroBlurb:
    "Find buyers. Qualify leads. Generate listings. Voice agents book showings 24/7.",
  capabilitiesHeadline: "Close more deals. Work fewer hours.",
  capabilitiesBlurb:
    "Every lead followed up. Every listing polished. Every showing booked. Your AI team never sleeps, never forgets, never drops the ball.",
  capabilities: [
    {
      icon: Home,
      title: "Property analysis & comparables",
      desc: "Feed in an address and get instant comp analysis, price history, neighborhood trends, and investment scoring. Agents pull from MLS data, county records, and market feeds in real time.",
    },
    {
      icon: PenLine,
      title: "Listing generation",
      desc: "Describe the property once and agents produce MLS-ready descriptions, social media posts, email blasts, and virtual tour scripts — all optimized for your target buyer persona.",
    },
    {
      icon: PhoneCall,
      title: "Lead qualification (voice + email)",
      desc: "Voice agents answer calls 24/7, qualify buyers by budget and timeline, book showings, and log everything to your CRM. Email agents nurture cold leads with personalized follow-up sequences.",
    },
    {
      icon: TrendingUp,
      title: "Market trend analysis",
      desc: "Weekly market intelligence reports for your target areas — price movements, inventory shifts, days-on-market trends, and emerging neighborhoods. Data-driven advice for your clients.",
    },
  ],
  workflowsHeadline: "Say what you need. Watch it happen.",
  workflows: [
    {
      trigger: '"Find 30 buyers looking for 3-bed homes in Austin under $500K"',
      steps: [
        "Agent scans your CRM and lead database for matching buyer profiles",
        "Cross-references search criteria with active and recently saved searches",
        "Scores each lead by engagement level, pre-approval status, and timeline urgency",
        "Generates a prioritized contact list with recommended outreach approach per lead",
      ],
      result:
        "30 qualified buyer leads ranked by likelihood to transact, with personalized talking points.",
    },
    {
      trigger: '"Write listing descriptions for my 5 new properties"',
      steps: [
        "Pulls property details, photos, and features from your MLS entries",
        "Generates unique, compelling descriptions highlighting each property's best features",
        "Optimizes for local SEO keywords and buyer search patterns",
        "Produces social media versions (Instagram, Facebook, LinkedIn) for each listing",
      ],
      result:
        "5 MLS-ready listings plus 15 social media posts — written in your brand voice.",
    },
    {
      trigger:
        '"Call all leads from this week\'s open house and book follow-ups"',
      steps: [
        "Retrieves sign-in sheet data from the open house (42 attendees)",
        "Voice agent calls each lead with a personalized follow-up referencing the property",
        "Qualifies interest level, budget range, and timeline in the conversation",
        "Books follow-up showings for interested buyers directly on your calendar",
      ],
      result:
        "42 calls made, 18 follow-up showings booked, 7 pre-approvals requested — by noon.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Pinecone",
      desc: "Vector memory — semantic search across listings, leads, and market data",
    },
    {
      icon: Layers,
      label: "Neon Postgres",
      desc: "Tenant-scoped relational store — brokerage-level data isolation",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every output verified for accuracy, compliance, and quality",
    },
    {
      icon: Zap,
      label: "Ollama Local",
      desc: "Air-gapped mode — client data stays on your infrastructure",
    },
  ],
  ctaHeadline: "Stop chasing leads manually.",
  ctaHighlight: "Start closing faster.",
  ctaBlurb:
    "Every lead gets followed up. Every listing gets polished. Every showing gets booked. Your AI team works while you're at the closing table.",
};

export default function ForRealEstatePage() {
  return <VerticalPageShell config={config} />;
}
