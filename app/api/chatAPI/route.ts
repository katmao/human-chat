import { ChatBody } from '@/types/types';
import { OpenAIStream } from '@/utils/chatStream';

export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  try {
    const { inputCode, model } = (await req.json()) as ChatBody;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.includes('sk-')) {
      return new Response('OpenAI API key not configured', { status: 500 });
    }

    const stream = await OpenAIStream(inputCode, model, apiKey);
    return new Response(stream);
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { inputCode, model } = (await req.json()) as ChatBody;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.includes('sk-')) {
      return new Response('OpenAI API key not configured', { status: 500 });
    }

    const stream = await OpenAIStream(inputCode, model, apiKey);
    return new Response(stream);
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
}
