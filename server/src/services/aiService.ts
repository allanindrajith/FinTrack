import { db } from '../db/database.js';
import { decryptServerSecret } from '../routes/users.js';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiExecutionOptions {
  userId: number;
  prompt: string;
  contextSummary?: string;
  systemPrompt?: string;
}

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const DAILY_FREE_QUOTA = 20;

export const aiService = {
  /**
   * Check if user is eligible for an AI query (free quota or BYO key)
   */
  async checkQuota(userId: number): Promise<{
    allowed: boolean;
    isByoKey: boolean;
    provider: string;
    apiKey: string;
    remainingQueries: number;
  }> {
    const user = await db.queryOne<{
      ai_consent: boolean | number;
      ai_provider: string;
      ai_byo_key_encrypted: string | null;
    }>(
      'SELECT ai_consent, ai_provider, ai_byo_key_encrypted FROM users WHERE id = $1',
      [userId]
    );

    if (!user || !user.ai_consent) {
      throw new Error('AI features are disabled. Please enable AI Insights in Settings.');
    }

    const provider = user.ai_provider || 'gemini';

    // If user has a configured BYO key
    if (user.ai_byo_key_encrypted) {
      const decryptedKey = decryptServerSecret(user.ai_byo_key_encrypted);
      if (decryptedKey && decryptedKey.trim().length > 0) {
        return {
          allowed: true,
          isByoKey: true,
          provider,
          apiKey: decryptedKey.trim(),
          remainingQueries: 999999,
        };
      }
    }

    // Default shared app quota check
    const today = new Date().toISOString().slice(0, 10);
    const countRes = await db.queryOne<{ count: number | string }>(
      `SELECT COUNT(*) as count FROM ai_conversations 
       WHERE user_id = $1 AND role = 'user' AND created_at >= $2`,
      [userId, `${today}T00:00:00.000Z`]
    );

    const usedToday = Number(countRes?.count || 0);
    const remainingQueries = Math.max(0, DAILY_FREE_QUOTA - usedToday);

    if (usedToday >= DAILY_FREE_QUOTA) {
      return {
        allowed: false,
        isByoKey: false,
        provider: 'gemini',
        apiKey: '',
        remainingQueries: 0,
      };
    }

    if (!DEFAULT_GEMINI_KEY) {
      throw new Error('FinTrack shared Gemini key is not configured. Please supply your own API key in Settings.');
    }

    return {
      allowed: true,
      isByoKey: false,
      provider: 'gemini',
      apiKey: DEFAULT_GEMINI_KEY,
      remainingQueries,
    };
  },

  /**
   * Execute chat query across Google Gemini, OpenAI, or Anthropic
   */
  async generateResponse(options: AiExecutionOptions): Promise<{ answer: string; provider: string; isByoKey: boolean }> {
    const quota = await this.checkQuota(options.userId);
    if (!quota.allowed) {
      throw new Error(
        `Daily free AI limit reached (${DAILY_FREE_QUOTA} queries/day). Connect your own API key in Settings for unlimited access.`
      );
    }

    const fullPrompt = `${options.systemPrompt || 'You are FinTrack AI, a trusted personal financial assistant. Answer questions concisely and provide smart budgeting advice based on the supplied context.'}\n\nFinancial Context:\n${options.contextSummary || 'No statement records provided.'}\n\nUser Question:\n${options.prompt}`;

    let answer = '';

    if (quota.provider === 'gemini') {
      answer = await callGemini(fullPrompt, quota.apiKey);
    } else if (quota.provider === 'openai') {
      answer = await callOpenAi(fullPrompt, quota.apiKey);
    } else if (quota.provider === 'anthropic') {
      answer = await callAnthropic(fullPrompt, quota.apiKey);
    } else {
      answer = await callGemini(fullPrompt, quota.apiKey);
    }

    // Log query in audit conversation history
    await db.execute(
      'INSERT INTO ai_conversations (user_id, role, content) VALUES ($1, $2, $3)',
      [options.userId, 'user', options.prompt.slice(0, 500)]
    );
    await db.execute(
      'INSERT INTO ai_conversations (user_id, role, content) VALUES ($1, $2, $3)',
      [options.userId, 'assistant', answer.slice(0, 1500)]
    );

    return {
      answer,
      provider: quota.provider,
      isByoKey: quota.isByoKey,
    };
  },

  /**
   * Auto-categorize a batch of transaction descriptions using the selected AI provider
   */
  async categorizeTransactions(
    userId: number,
    descriptions: string[],
    categories: string[]
  ): Promise<Array<{ description: string; categoryName: string; confidence: number }>> {
    const quota = await this.checkQuota(userId);
    if (!quota.allowed) {
      throw new Error(
        `Daily free AI limit reached (${DAILY_FREE_QUOTA} queries/day). Connect your own API key in Settings for unlimited access.`
      );
    }

    const prompt = `You are a financial transaction categorization engine. 
Given the following list of transaction descriptions and the list of available categories, categorize each transaction into exactly one of the available categories.
Available Categories:
${categories.join(', ')}

Transactions to categorize:
${descriptions.map((d, i) => `${i + 1}. "${d}"`).join('\n')}

Output ONLY valid JSON in this exact structure without markdown or explanation:
{
  "categorizations": [
    { "description": "...", "categoryName": "...", "confidence": 0.95 }
  ]
}`;

    let rawOutput = '';
    if (quota.provider === 'gemini') {
      rawOutput = await callGemini(prompt, quota.apiKey);
    } else if (quota.provider === 'openai') {
      rawOutput = await callOpenAi(prompt, quota.apiKey);
    } else if (quota.provider === 'anthropic') {
      rawOutput = await callAnthropic(prompt, quota.apiKey);
    } else {
      rawOutput = await callGemini(prompt, quota.apiKey);
    }

    try {
      const cleaned = rawOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed.categorizations || [];
    } catch {
      return descriptions.map((desc) => ({
        description: desc,
        categoryName: categories[0] || 'Uncategorized',
        confidence: 0.5,
      }));
    }
  },
};

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      },
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as any;
    throw new Error(err.error?.message || `Google Gemini API returned status ${res.status}`);
  }

  const data = (await res.json()) as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || 'Unable to generate financial insight at this time.';
}

async function callOpenAi(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as any;
    throw new Error(err.error?.message || `OpenAI API returned status ${res.status}`);
  }

  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content || 'Unable to generate response from OpenAI.';
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as any;
    throw new Error(err.error?.message || `Anthropic API returned status ${res.status}`);
  }

  const data = (await res.json()) as any;
  return data.content?.[0]?.text || 'Unable to generate response from Anthropic.';
}
