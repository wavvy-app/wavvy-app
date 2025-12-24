import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getCandidate } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const body = await req.json() as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const { searchParams } = new URL(req.url);
        const candidateId = searchParams.get('candidate_id');
        const questionIndex = searchParams.get('question_index');

        if (!candidateId) {
          throw new Error('Candidate ID is required');
        }

        const candidate = await getCandidate(interview_id, candidateId);
        if (!candidate) {
          throw new Error('Candidate not found');
        }

        return {
          allowedContentTypes: [
            'video/webm',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/mp4',
          ],
          tokenPayload: JSON.stringify({
            interview_id,
            candidate_id: candidateId,
            question_index: questionIndex,
          }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload video' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidate_id');
 
    if (!candidateId) {
      return NextResponse.json(
        { error: 'candidate_id query parameter is required' },
        { status: 400 }
      );
    }
 
    const { getRecordings } = await import('@/lib/db');
    const recordings = await getRecordings(interview_id, candidateId);
 
    return NextResponse.json({ recordings });
  } catch (error: any) {
    console.error('[Upload] Get recordings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}