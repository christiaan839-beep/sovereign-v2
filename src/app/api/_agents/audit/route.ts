import { NextResponse } from 'next/server';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { targetUrl } = await req.json();

    if (!targetUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Physically scrape the target website
    let scrapedText = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SovereignMatrix/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        // Remove garbage scripts and styles
        $('script, style, nav, footer, iframe').remove();
        scrapedText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 15000);
      }
    } catch {
      console.warn('Scraping firewall hit. Synthesizing based on domain heuristics.');
    }

    // 2. Feed into Google AI Ultra (Gemini 1.5 Pro)
    const { object } = await generateObject({
      model: google('gemini-1.5-pro'),
      schema: z.object({
        companyName: z.string(),
        criticalFlaws: z.array(z.string()).describe("Maximum 3 brutal, high-level business logic flaws regarding human labor or generic SaaS."),
        costInefficiency: z.string().describe("An estimated dollar amount formatting, e.g. '$24,000/mo burned on human execution'"),
        aiReplacementStrategy: z.string().describe("What Sovereign Matrix node replaces their entire model.")
      }),
      system: `You are the Sovereign Matrix God-Brain. You generate brutal, defense-contractor style Threat Assessments against competitor B2B agencies. Analyze this scraped website text and output a high-ticket audit designed to convince their clients to switch to an autonomous AI sovereign node.`,
      prompt: `Target URL: ${targetUrl}\n\nScraped Intel:\n${scrapedText || 'Firewalled. Infer business model from domain name.'}`
    });

    return NextResponse.json({
      ...object,
      pdfReady: true
    });

  } catch (error: unknown) {
    console.error('[AUDIT_ENGINE_ERROR]', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
