const AI_PROVIDER = (process.env.AI_PROVIDER ?? 'claude') as 'openai' | 'claude';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

const MAX_TOKENS = 4096;

export const AI_GENERATED_BY = AI_PROVIDER === 'claude' ? 'claude-automata' : 'gpt-automata';

export const callAi = async (
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  timeoutMs = 50_000
): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (AI_PROVIDER === 'claude') {
      if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY hiányzik a környezeti változók közül.');

      const response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(errorPayload.error?.message ?? 'A Claude API hívás sikertelen.');
      }

      const json = await response.json() as { content?: Array<{ text?: string }> };
      const text = json.content?.[0]?.text?.trim();
      if (!text) throw new Error('A Claude válasza nem tartalmazott szöveget.');
      return text;
    }

    // OpenAI (alapértelmezett)
    if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY hiányzik a környezeti változók közül.');

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(errorPayload.error?.message ?? 'Az OpenAI hívás sikertelen.');
    }

    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Az OpenAI válasza nem tartalmazott szöveget.');
    return text;
  } finally {
    clearTimeout(timeout);
  }
};
