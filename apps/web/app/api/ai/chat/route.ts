import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const message = body.message as string;

  // TODO: replace this with real OpenAI/LLM call
  return NextResponse.json({
    reply: `Echo from CarePulse AI: ${message}`
  });
}
