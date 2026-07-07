import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    const { prompt, systemInstruction } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in Secrets' },
        { status: 500 }
      );
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction:
          systemInstruction ||
          'You are an expert technical editor and content strategist. Provide clear, professional additions that fit into the wiki format.',
      },
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini API Integration Failure:', error);
    return NextResponse.json(
      { error: error?.message || 'Error occurred during AI processing' },
      { status: 500 }
    );
  }
}
