
import { NextResponse } from "next/server";
import OpenAI from "openai";
// Polyfill for pdf-parse (requires Canvas/DOMMatrix in Node.js)
try {
    // @ts-ignore
    const canvas = require("@napi-rs/canvas");
    if (!global.DOMMatrix) {
        // @ts-ignore
        global.DOMMatrix = canvas.DOMMatrix;
        // @ts-ignore
        global.ImageData = canvas.ImageData;
        // @ts-ignore
        global.Path2D = canvas.Path2D;
    }
} catch (e) {
    console.warn("Could not load @napi-rs/canvas for pdf-parse polyfill", e);
}

// @ts-ignore
const pdf = require("pdf-parse/lib/pdf-parse.js");

// Force Node.js runtime for pdf-parse compatibility
export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy", // Fallback to avoid crash on build
});

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    try {
      const data = await pdf(buffer);
      return `[PDF File: ${file.name}]\n${data.text}`;
    } catch (e) {
      console.error("PDF parse error:", e);
      return `[PDF File: ${file.name}] (Could not parse text)`;
    }
  } else if (file.type.startsWith("image/")) {
    // For images, we can't extract text easily without OCR. 
    // In a real full impl, we'd send the image to GPT-4o Vision directly.
    // For now, we will mark it as an image to be sent to Vision if we implement that, 
    // or just say we see an image.
    // To actually USE the image with OpenAI, we need to send the base64 URL.
    return `[Image File: ${file.name}] (Image content)`;
  }
  return "";
}

// Helper to convert File to base64 data URL for OpenAI Vision
async function fileToBase64(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const message = formData.get("message") as string;
    const files = formData.getAll("files") as File[];

    let context = "";
    const visionContent: any[] = [];

    // Process files
    for (const file of files) {
      if (file.type === "application/pdf") {
        console.log(`Processing PDF file: ${file.name}`);
        const text = await extractTextFromFile(file);
        console.log(`Extracted text length: ${text.length}`);
        console.log(`Extracted text preview: ${text.substring(0, 200)}...`);
        context += text + "\n\n";
      } else if (file.type.startsWith("image/")) {
        // Add to vision content
        const base64 = await fileToBase64(file);
        visionContent.push({
          type: "image_url",
          image_url: {
            url: base64,
          },
        });
      }
    }

    const systemPrompt = `
    You are CarePulse Assistant, an AI that helps patients understand their medical reports and prescriptions.
    
    INSTRUCTIONS:
    1. Analyze the provided context (text from PDFs) and any attached images.
    2. Answer the user's question or summarize the documents in simple, patient-friendly language.
    3. If the user asks for a summary, provide key points like:
       - Doctor's name / Clinic
       - Key findings or Diagnosis (as stated in the doc)
       - Prescribed medications (names, dosage if clear)
       - Next steps
    
    SAFETY GUARDRAILS (CRITICAL):
    - DO NOT provide a personal medical diagnosis.
    - DO NOT prescribe medications or recommend changing dosage.
    - DO NOT tell the user to stop taking their meds.
    - ALWAYS refer to the information explicitly found in the documents.
    - If unsure, say you cannot read that part clearly.
    
    DISCLAIMER:
    Always end your response with:
    \n\n_"I'm an AI assistant, not a doctor. This is informational only. Please consult a qualified clinician for medical advice."_
    `;

    // Construct user message
    // If we have images, we use the complex content type.
    // If text only, simpler.
    
    const userContent: any[] = [];
    
    if (context) {
        userContent.push({ type: "text", text: `Context from uploaded PDF files:\n${context}` });
    }

    if (message) {
        userContent.push({ type: "text", text: `User Question: ${message}` });
    } else if (files.length > 0) {
        userContent.push({ type: "text", text: "Please summarize these documents for me." });
    }

    // Add images to user content
    // spread visionContent into userContent
     // ...visionContent logic but mapped correctly
    visionContent.forEach(v => userContent.push(v));

    if (userContent.length === 0) {
        return NextResponse.json({ reply: "Please provide a message or a file." });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use a vision-capable model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 1000,
    });

    const reply = response.choices[0]?.message?.content || "I couldn't generate a response.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("AI Chat Error:", error);
    return NextResponse.json(
      { reply: "Sorry, I encountered an error processing your request. Please check your connection and API key." },
      { status: 500 }
    );
  }
}
