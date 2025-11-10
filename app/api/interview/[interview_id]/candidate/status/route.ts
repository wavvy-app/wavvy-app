import { NextRequest, NextResponse } from 'next/server';
import { updateCandidateStatus, getCandidate } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const { candidate_id, status } = await req.json();

    if (!candidate_id) {
      return NextResponse.json(
        { error: 'candidate_id is required' },
        { status: 400 }
      );
    }

    if (!status || !['recording', 'submitted'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "recording" or "submitted"' },
        { status: 400 }
      );
    }

    const candidate = await getCandidate(interview_id, candidate_id);
    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    await updateCandidateStatus(interview_id, candidate_id, status);

    return NextResponse.json({
      success: true,
      candidate_id,
      status,
      message: `Candidate status updated to "${status}"`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update candidate status';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}