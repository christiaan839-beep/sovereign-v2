import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * FIRECRAWL AGENT — Open-Source Web Scraper
 * Uses the Firecrawl API to turn any website into LLM-ready markdown.
 * Bypasses anti-bot protections natively.
 */
export async function POST(req: Request) {
  try {
    const { url, formats = ["markdown"] } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Target URL is required." }, { status: 400 });
    }

    // Attempt to pull user's Firecrawl key if available
    let apiKey = process.env.FIRECRAWL_API_KEY || "";
    const user = await currentUser();
    
    if (user?.primaryEmailAddress?.emailAddress) {
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userEmail, user.primaryEmailAddress.emailAddress)
      });
      if (userSettings?.apiKeys) {
        const keys = JSON.parse(userSettings.apiKeys);
        if (keys.firecrawl) apiKey = keys.firecrawl;
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "Firecrawl API key required." }, { status: 401 });
    }

    // Call Firecrawl Scrape API
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url,
        formats
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Firecrawl request failed: ${response.status}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      url: data.data?.metadata?.sourceURL || url,
      markdown: data.data?.markdown || "",
      title: data.data?.metadata?.title || "Unknown Page",
      status: "Extracted via Open-Source Node"
    });

  } catch (error) {
    return NextResponse.json({ error: "Firecrawl Scraper Error", details: String(error) }, { status: 500 });
  }
}
