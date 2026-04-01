import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deepSearch } from "@/lib/deep-search";
import { createLogger } from "@/lib/logger";

const log = createLogger("deep-search");

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    const result = await deepSearch(query);

    return NextResponse.json({
      output: result.answer,
      sources: result.sources,
      searchQueries: result.searchQueries,
      confidence: result.confidence,
      model: "deep-search",
    });
  } catch (err) {
    log.error("Deep search failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
