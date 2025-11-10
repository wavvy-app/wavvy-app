import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { saveRecording, getCandidate } from '@/lib/db';
 
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
   
    const formData = await req.formData();
    const videoFile = formData.get('video') as File;
    const candidateId = formData.get('candidate_id') as string;
    const questionIndex = parseInt(formData.get('question_index') as string);
 
    if (!videoFile) {
      return NextResponse.json(
        { error: 'Video file is required' },
        { status: 400 }
      );
    }
 
    if (!candidateId) {
      return NextResponse.json(
        { error: 'Candidate ID is required' },
        { status: 400 }
      );
    }
 
    if (isNaN(questionIndex)) {
      return NextResponse.json(
        { error: 'Invalid question index' },
        { status: 400 }
      );
    }
 
    const candidate = await getCandidate(interview_id, candidateId);
    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }
 
    const filename = `interviews/${interview_id}/${candidateId}/question-${questionIndex}.webm`;
   
    const blob = await put(filename, videoFile, {
      access: 'public',
      addRandomSuffix: false,
    });
 
    await saveRecording(interview_id, candidateId, {
      question_index: questionIndex,
      video_url: blob.url,
      duration: 0,
      uploaded_at: new Date().toISOString(),
    });
 
    return NextResponse.json({
      success: true,
      video_url: blob.url,
      question_index: questionIndex,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
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
    console.error('Get recordings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}