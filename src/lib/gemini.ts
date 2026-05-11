import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.GEMINI_API_KEY ||
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.GEMINI_API_KEY;

export interface BioGenerationResult {
  bio: string;
  ok: boolean;
  source: 'ai' | 'fallback';
  message?: string;
}

function buildFallbackBio(interests: string[], displayName?: string) {
  const readableInterests = interests
    .slice(0, 3)
    .map((interest) => interest.replace(/-/g, ' '))
    .join(', ');

  const name = displayName?.trim() || 'This member';
  return `${name} brings a thoughtful perspective shaped by ${readableInterests}, and values meaningful collaboration within the society.`;
}

export async function generateBio(interests: string[], displayName?: string): Promise<BioGenerationResult> {
  if (interests.length === 0) {
    return {
      ok: false,
      bio: '',
      source: 'fallback',
      message: 'Choose at least one interest to generate a bio.',
    };
  }

  const fallbackBio = buildFallbackBio(interests, displayName);

  if (!apiKey) {
    return {
      ok: true,
      bio: fallbackBio,
      source: 'fallback',
      message: 'AI bio generation is unavailable right now, so a polished profile-ready bio was created instead.',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Write one premium, welcoming member bio for ${displayName || 'a new member'} based on these interests: ${interests.join(", ")}. Keep it under 150 characters. Return only the bio text with no quotes, labels, numbering, or extra commentary.`,
      config: {
        temperature: 0.8,
      },
    });

    const bio = response.text?.trim().replace(/^['"]|['"]$/g, '');
    if (!bio) {
      return {
        ok: true,
        bio: fallbackBio,
        source: 'fallback',
        message: 'The AI response was empty, so a polished fallback bio was generated instead.',
      };
    }

    return {
      ok: true,
      bio,
      source: 'ai',
    };
  } catch (error: any) {
    console.error("Bio generation failed:", error);
    return {
      ok: true,
      bio: fallbackBio,
      source: 'fallback',
      message: error?.message || 'Bio generation failed. A fallback bio was created instead.',
    };
  }
}
