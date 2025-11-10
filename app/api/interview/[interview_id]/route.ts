import { NextRequest, NextResponse } from 'next/server';
import { getInterview } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const data = await getInterview(interview_id);
    
    if (!data) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}