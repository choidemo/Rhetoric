
// /app/api/gemini/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  createCounselingPrompt,
  createStudentReactionPrompt,
  createTeacherEvaluationPrompt,
} from '@/lib/prompts';

const API_KEY = process.env.GEMINI_API_KEY;
const PRO_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${API_KEY}`;
const FLASH_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

async function callGeminiAPI(prompt: string, apiUrl: string) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error Response:', data);
      const errorMessage = data?.error?.message || 'Unknown error';
      return NextResponse.json(
        {
          error:
            `[오류 발생] AI 서버에서 에러를 반환했습니다. (코드: ${response.status}) 관리자에게 문의하세요. 에러 메시지: ${errorMessage}`,
        },
        { status: response.status }
      );
    }

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.log('API Success Response with empty content:', data);
      return '[오류 발생] AI가 응답을 생성했지만 내용이 비어있습니다. 다시 시도해주세요.';
    }
  } catch (e: unknown) {
    console.error('API 호출 오류:', e);
    return NextResponse.json(
      {
        error:
          '[오류 발생] AI 서버와 통신하는 중 문제가 발생했습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, ...params } = await req.json();

    let prompt;
    let apiUrl;

    switch (action) {
      case 'getCounselingResponse':
        prompt = createCounselingPrompt(
          params.teacherInput,
          params.history,
          params.topic
        );
        apiUrl = FLASH_API_URL;
        break;
      case 'getStudentFinalReaction':
        prompt = createStudentReactionPrompt(
          params.fullConversation,
          params.topic
        );
        apiUrl = PRO_API_URL;
        break;
      case 'getTeacherEvaluation':
        prompt = createTeacherEvaluationPrompt(
          params.fullConversation,
          params.topic
        );
        apiUrl = PRO_API_URL;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const result = await callGeminiAPI(prompt, apiUrl);

    if (result instanceof NextResponse) {
        return result; // Error response from callGeminiAPI
    }

    return NextResponse.json({ response: result });

  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
