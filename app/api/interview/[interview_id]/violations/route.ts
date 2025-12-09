// app/api/interview/[interview_id]/violations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { saveViolation, getViolations } from '@/lib/db';

/**
 * POST /api/interview/[interview_id]/violations
 * 
 * Saves a proctoring violation to the candidate's record
 * 
 * Body:
 * {
 *   candidate_id: string,
 *   violation: {
 *     type: 'NO_FACE' | 'MULTIPLE_FACES' | 'LOOKING_AWAY' | 'CAMERA_OFF' | 'TAB_SWITCH',
 *     timestamp: number,
 *     message: string
 *   }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const body = await request.json();
    
    const { candidate_id, violation } = body;

    // Validate required fields
    if (!candidate_id) {
      return NextResponse.json(
        { error: 'candidate_id is required' },
        { status: 400 }
      );
    }

    if (!violation) {
      return NextResponse.json(
        { error: 'violation data is required' },
        { status: 400 }
      );
    }

    // Validate violation structure
    if (!violation.type || !violation.message || typeof violation.timestamp !== 'number') {
      return NextResponse.json(
        { error: 'Invalid violation data. Required: type, message, timestamp' },
        { status: 400 }
      );
    }

    // Validate violation type
    const validTypes = ['NO_FACE', 'MULTIPLE_FACES', 'LOOKING_AWAY', 'CAMERA_OFF', 'TAB_SWITCH'];
    if (!validTypes.includes(violation.type)) {
      return NextResponse.json(
        { error: `Invalid violation type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Save violation to candidate record
    await saveViolation(interview_id, candidate_id, violation);

    return NextResponse.json({ 
      success: true,
      message: 'Violation logged successfully'
    });
    
  } catch (error) {
    console.error('[Violations API] Error saving violation:', error);
    
    // Handle specific error cases
    if (error instanceof Error && error.message === 'Candidate not found') {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save violation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/interview/[interview_id]/violations?candidate_id=xxx
 * 
 * Retrieves all violations for a specific candidate
 * 
 * Query params:
 *   candidate_id: string (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const { searchParams } = new URL(request.url);
    const candidate_id = searchParams.get('candidate_id');

    if (!candidate_id) {
      return NextResponse.json(
        { error: 'candidate_id query parameter is required' },
        { status: 400 }
      );
    }

    const violations = await getViolations(interview_id, candidate_id);

    return NextResponse.json({ 
      violations,
      count: violations.length
    });
    
  } catch (error) {
    console.error('[Violations API] Error fetching violations:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch violations' },
      { status: 500 }
    );
  }
}