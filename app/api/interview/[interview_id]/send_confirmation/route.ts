import { NextRequest, NextResponse } from 'next/server';
import { getCandidate, getInterview } from '@/lib/db';
import { sendCandidateConfirmationEmail } from '@/lib/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const { candidate_id } = await req.json();

    if (!candidate_id) {
      return NextResponse.json(
        { error: 'candidate_id is required' },
        { status: 400 }
      );
    }

    const candidate = await getCandidate(interview_id, candidate_id);
    const interview = await getInterview(interview_id);

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }

    const submittedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const result = await sendCandidateConfirmationEmail({
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      jobTitle: interview.job_title,
      questionsCount: interview.questions.length,
      submittedDate,
    });

    return NextResponse.json({
      success: true,
      message: 'Confirmation email sent successfully',
      emailId: result.emailId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: true,
      warning: 'Interview submitted but email failed to send',
      error: message,
    }, { status: 200 });
  }
}