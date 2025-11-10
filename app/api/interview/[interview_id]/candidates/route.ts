import { NextRequest, NextResponse } from 'next/server';
import { getCandidatesByInterview } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;

    const candidates = await getCandidatesByInterview(interview_id);

    const formattedCandidates = candidates.map(candidate => {
      const candidateData = candidate as any;
      
      return {
        candidate_id: candidateData.candidate_id,
        name: candidateData.name,
        email: candidateData.email,
        phone: candidateData.phone,
        years_experience: candidateData.years_experience,
        salary_expectations: candidateData.salary_expectations,
        status: candidateData.status,
        registered_at: candidateData.registered_at,
        overall_score: candidateData.results?.overallScore,
        top_strengths: candidateData.results?.topStrengths,
        areas_to_improve: candidateData.results?.areasToImprove,
        processed_at: candidateData.results?.processedAt,
      };
    });

    return NextResponse.json({
      success: true,
      count: formattedCandidates.length,
      candidates: formattedCandidates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch candidates';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}