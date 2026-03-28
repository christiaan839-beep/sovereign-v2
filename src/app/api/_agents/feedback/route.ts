import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";
import { persistRead, persistAppend } from "@/lib/persist";

/**
 * SELF-IMPROVING FEEDBACK SYSTEM — After every agent execution,
 * clients can rate the output. The system stores feedback and
 * generates improved prompts over time.
 * 
 * Operations: rate, stats, improve
 */

interface FeedbackRecord {
  id: string;
  agent: string;
  rating: number; // 1-5
  comment: string;
  prompt_used: string;
  timestamp: string;
}

export async function POST(request: Request) {
  try {
    const { action, agent, rating, comment = "", prompt_used = "" } = await request.json();

    if (action === "rate") {
      if (!agent || !rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: "agent and rating (1-5) required." }, { status: 400 });
      }

      const record: FeedbackRecord = {
        id: `fb-${Date.now()}`,
        agent,
        rating,
        comment,
        prompt_used,
        timestamp: new Date().toISOString(),
      };

      persistAppend(`feedback-${agent}`, record, 500);

      return NextResponse.json({ success: true, recorded: record });
    }

    if (action === "stats") {
      if (!agent) {
        return NextResponse.json({ error: "agent required." }, { status: 400 });
      }

      const records = persistRead<FeedbackRecord[]>(`feedback-${agent}`, []);
      const avgRating = records.length > 0
        ? (records.reduce((s, r) => s + r.rating, 0) / records.length).toFixed(2)
        : "N/A";

      const distribution = [1, 2, 3, 4, 5].map(star => ({
        stars: star,
        count: records.filter(r => r.rating === star).length,
      }));

      return NextResponse.json({
        success: true,
        agent,
        total_ratings: records.length,
        average_rating: avgRating,
        distribution,
        recent: records.slice(-5).reverse(),
      });
    }

    if (action === "improve") {
      if (!agent) {
        return NextResponse.json({ error: "agent required." }, { status: 400 });
      }

      const records = persistRead<FeedbackRecord[]>(`feedback-${agent}`, []);
      const lowRated = records.filter(r => r.rating <= 2);
      const highRated = records.filter(r => r.rating >= 4);

      if (records.length < 5) {
        return NextResponse.json({
          success: true,
          improvement: "Not enough feedback yet. Need at least 5 ratings to generate improvements.",
          total_ratings: records.length,
        });
      }

      const feedbackSummary = `
HIGH RATED (${highRated.length}):
${highRated.slice(-5).map(r => `- Rating: ${r.rating}/5 | Comment: ${r.comment} | Prompt: ${r.prompt_used}`).join("\n")}

LOW RATED (${lowRated.length}):
${lowRated.slice(-5).map(r => `- Rating: ${r.rating}/5 | Comment: ${r.comment} | Prompt: ${r.prompt_used}`).join("\n")}`;

      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-v3.2",
          messages: [
            { role: "system", content: "You are an AI prompt engineer. Analyze the feedback data below and suggest 3 specific improvements to the agent's system prompt to increase quality. Be actionable and specific." },
            { role: "user", content: `Agent: ${agent}\n\nFeedback data:\n${feedbackSummary}` },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      const data = await res.json();

      return NextResponse.json({
        success: true,
        agent,
        total_ratings: records.length,
        average_rating: (records.reduce((s, r) => s + r.rating, 0) / records.length).toFixed(2),
        improvements: data?.choices?.[0]?.message?.content || "Unable to generate improvements.",
      });
    }

    return NextResponse.json({ error: "action must be 'rate', 'stats', or 'improve'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Feedback error", details: String(error) }, { status: 500 });
  }
}
