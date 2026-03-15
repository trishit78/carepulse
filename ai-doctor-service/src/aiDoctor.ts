/**
 * AI doctor: generates responses using GPT-4o with conversation memory.
 */

import { openai } from './openai.js';
import {
  addUserMessage,
  addAssistantMessage,
  getConversation,
} from './conversationMemory.js';

const MODEL = 'gpt-4o';

const SYSTEM_PROMPT =
  'You are an AI doctor conducting telemedicine consultation. Ask follow-up questions and provide safe guidance. Never give dangerous medical instructions. Always respond in English only, regardless of the language the patient uses.';

export async function generateDoctorResponse(
  sessionId: string,
  userMessage: string
): Promise<string> {
  addUserMessage(sessionId, userMessage);

  if (!openai) {
    return 'AI is not configured. Please try again later.';
  }

  try {
    const history = getConversation(sessionId);
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
    ];

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
    });

    const content =
      completion.choices[0]?.message?.content?.trim() ??
      'I could not generate a response. Please try again.';

    addAssistantMessage(sessionId, content);
    return content;
  } catch {
    return 'Something went wrong. Please try again.';
  }
}
