import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { Digest } from '@/types/digest';

function buildContext(digest: Digest): string {
  return digest.posts
    .map((post, i) => {
      const commentBlock = post.comments
        .map((c) => `    ${c.by}: ${c.text.slice(0, 600)}`)
        .join('\n');
      return `${i + 1}. "${post.title}"
   Score: ${post.score} | By: ${post.by} | Comments: ${post.descendants}
   URL: ${post.url}
   Top comments:
${commentBlock || '   (none)'}`;
    })
    .join('\n\n');
}

export async function POST(req: NextRequest) {
  const { question, digest }: { question: string; digest: Digest } =
    await req.json();

  if (!question?.trim() || !digest) {
    return NextResponse.json({ error: 'Missing question or digest.' }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured.' }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are an assistant analyzing today's Hacker News top stories.

Here are today's top 10 posts with their top comments:

${buildContext(digest)}

Answer the following question concisely and insightfully. Use plain text — no markdown formatting.

Question: ${question}`;

  const result = await model.generateContent(prompt);
  return NextResponse.json({ answer: result.response.text() });
}
