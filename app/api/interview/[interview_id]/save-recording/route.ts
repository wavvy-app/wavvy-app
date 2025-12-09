import { NextRequest, NextResponse } from 'next/server';
import { saveRecording } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const { candidate_id, question_index, video_url, duration } = await req.json();

    if (!candidate_id || question_index === undefined || !video_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await saveRecording(interview_id, candidate_id, {
      question_index: parseInt(question_index),
      video_url,
      duration: duration || 0,
      uploaded_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Save Recording] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save recording' },
      { status: 500 }
    );
  }
}