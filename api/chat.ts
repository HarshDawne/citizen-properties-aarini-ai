import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../src/constants';

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

    // Response shape varies; prefer `text` if present
    const text = response?.text ??
      (Array.isArray(response?.candidates) && response.candidates[0]?.content?.text) ??
      JSON.stringify(response);

    res.status(200).json({ text, raw: response });
  } catch (err: any) {
    console.error('api/chat error:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
