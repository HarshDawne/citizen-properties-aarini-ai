import { GoogleGenAI } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../src/constants';

// Basic in-memory rate limiter. Note: serverless functions are stateless across
// instances, so this limiter works per-instance and is not globally accurate.
const rateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 8;

function getClientIp(req: any) {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Use `any` for req/res to avoid build-time type dependency on `@vercel/node` types
// which may not be present in the Vercel build environment. This keeps the
// serverless function simple and avoids TS compile errors during deploy.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Missing message in request body' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    return;
  }

  // Rate limiting per IP
  const ip = getClientIp(req);
  const now = Date.now();
  const timestamps = rateLimits.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - recent[0])) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: `Rate limit exceeded. Retry in ${retryAfter} seconds.` });
    return;
  }
  recent.push(now);
  rateLimits.set(ip, recent);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    // Use non-streaming sendMessage to get full response
    const response = await chat.sendMessage({ message });

    // Response shape varies; prefer `text` if present. Use `any` to avoid strict
    // typing issues from the SDK in the build environment.
    const respAny: any = response;
    let text: string | undefined;
    if (respAny && typeof respAny.text === 'string') {
      text = respAny.text;
    } else if (respAny && Array.isArray(respAny.candidates) && respAny.candidates[0]) {
      const cand: any = respAny.candidates[0];
      if (cand && cand.content && typeof cand.content.text === 'string') text = cand.content.text;
    }
    if (!text) text = JSON.stringify(respAny);

    res.status(200).json({ text, raw: response });
  } catch (err: any) {
    console.error('api/chat error:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
