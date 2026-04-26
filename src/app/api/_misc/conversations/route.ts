import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { conversations, chatMessages } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import crypto from "crypto";
const log = createLogger("conversations");

/**
 * CONVERSATION PERSISTENCE API
 * GET  — Load user's conversations (last 10)
 * POST — Save/update a conversation with messages
 */

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const convos = await db
      .select()
      .from(conversations)
      .where(eq(conversations.clerkUserId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(10);

    // Load messages for each conversation (last 100 per convo)
    const result = await Promise.all(
      convos.map(async (c) => {
        const msgs = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.conversationId, c.id))
          .orderBy(chatMessages.createdAt)
          .limit(100);
        return { ...c, messages: msgs };
      }),
    );

    return NextResponse.json({ conversations: result });
  } catch (err) {
    log.error("Conversations GET error", err as Record<string, unknown>);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const body = await req.json();
    const { conversationId, title, model, systemPrompt, messages: msgs } = body;

    if (!msgs || !Array.isArray(msgs)) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 },
      );
    }

    let convId = conversationId;

    if (!convId) {
      // Create new conversation
      const [newConv] = await db
        .insert(conversations)
        .values({
          clerkUserId: userId,
          title: title || "New Mission",
          model: model || "auto",
          systemPrompt: systemPrompt || null,
        })
        .returning({ id: conversations.id });
      convId = newConv.id;
    } else {
      // Verify ownership before any UPDATE — prevents IDOR
      const [owned] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, convId),
            eq(conversations.clerkUserId, userId),
          ),
        )
        .limit(1);

      if (!owned) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      // Update existing conversation metadata — scoped by user
      await db
        .update(conversations)
        .set({
          title: title || undefined,
          model: model || undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(conversations.id, convId),
            eq(conversations.clerkUserId, userId),
          ),
        );
    }

    // Upsert messages — only insert new ones (by checking if they already exist).
    // Server generates IDs for incoming messages; we never trust client-supplied row IDs.
    if (msgs.length > 0) {
      const existingMsgs = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, convId));

      const existingIds = new Set(existingMsgs.map((m) => m.id));

      // Filter: only "new" client rows that haven't been persisted yet.
      // We use the client-provided id only as a dedupe key for this conversation,
      // and replace it with a server-generated UUID before insert.
      const newMsgs = msgs.filter(
        (m: { id?: string }) => !m.id || !existingIds.has(m.id),
      );

      if (newMsgs.length > 0) {
        await db.insert(chatMessages).values(
          newMsgs.map(
            (m: {
              role: string;
              content: string;
              agentLabel?: string;
              responseTimeMs?: number;
            }) => ({
              id: crypto.randomUUID(),
              conversationId: convId,
              role: m.role,
              content: m.content,
              agentLabel: m.agentLabel || null,
              responseTimeMs: m.responseTimeMs || null,
            }),
          ),
        );
      }
    }

    return NextResponse.json({ conversationId: convId, saved: true });
  } catch (err) {
    log.error("Conversations POST error", err as Record<string, unknown>);
    return NextResponse.json(
      { error: "Failed to save conversation" },
      { status: 500 },
    );
  }
}
