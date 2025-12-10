import { kv } from '@vercel/kv';

// ========================================
// INTERFACES
// ========================================

interface InterviewData {
  job_title: string;
  industry?: string;
  seniority?: string;
  job_type?: string;
  work_model?: string;
  location?: string;
  role_template: string;
  key_responsibilities?: string[];
  required_skills?: string[];
  opening_questions?: string;  // NEW: Replaces custom_questions
  closing_questions?: string;  // NEW: Added for closing questions
  questions: string[];
  created_at: string;
}

interface CandidateData {
  interview_id: string;
  candidate_id: string;
  name: string;
  email: string;
  phone?: string;
  years_experience: number;
  salary_expectations: string;
  location_confirmed?: boolean;
  consent_given: boolean;
  consent_timestamp: string;
  question_order: number[];
  registered_at: string;
  recordings?: Recording[];
  results?: InterviewResults;
  status: 'registered' | 'recording' | 'submitted' | 'scored' | 'terminated';
  violations?: Violation[];
}

interface Recording {
  question_index: number;
  video_url: string;
  duration: number;
  uploaded_at: string;
  transcript?: string;
  score?: number;
}

interface InterviewResults {
  transcripts: string[];
  questionScores: Array<{
    question: string;
    transcript: string;
    score: number;
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  overallScore: number;
  overallFeedback: string;
  topStrengths: string[];
  areasToImprove: string[];
  processedAt: string;
}

interface Violation {
  type: 'NO_FACE' | 'MULTIPLE_FACES' | 'LOOKING_AWAY' | 'CAMERA_OFF' | 'TAB_SWITCH';
  timestamp: number;
  message: string;
}

// ========================================
// CONSTANTS
// ========================================

const EXPIRY_DAYS = 30;
const EXPIRY_SECONDS = EXPIRY_DAYS * 24 * 60 * 60;

// ========================================
// INTERVIEW FUNCTIONS
// ========================================

export async function saveInterview(
  interviewId: string, 
  data: InterviewData
): Promise<void> {
  await kv.set(`interview:${interviewId}`, data);
  await kv.expire(`interview:${interviewId}`, EXPIRY_SECONDS);
}

export async function getInterview(
  interviewId: string
): Promise<InterviewData | null> {
  return await kv.get<InterviewData>(`interview:${interviewId}`);
}

// ========================================
// CANDIDATE FUNCTIONS
// ========================================

export async function saveCandidate(
  interviewId: string,
  candidateId: string,
  data: CandidateData
): Promise<void> {
  const key = `candidate:${interviewId}:${candidateId}`;
  await kv.set(key, data);
  await kv.expire(key, EXPIRY_SECONDS);
}

export async function getCandidate(
  interviewId: string,
  candidateId: string
): Promise<CandidateData | null> {
  const key = `candidate:${interviewId}:${candidateId}`;
  return await kv.get<CandidateData>(key);
}

export async function updateCandidateStatus(
  interviewId: string,
  candidateId: string,
  status: 'recording' | 'submitted' | 'scored' | 'terminated'
): Promise<void> {
  const candidate = await getCandidate(interviewId, candidateId);
  
  if (!candidate) {
    throw new Error('Candidate not found');
  }

  const key = `candidate:${interviewId}:${candidateId}`;
  await kv.set(key, { ...candidate, status });
}

export async function getCandidatesByInterview(
  interviewId: string
): Promise<CandidateData[]> {
  const pattern = `candidate:${interviewId}:*`;
  const keys = await kv.keys(pattern);
  
  if (!keys || keys.length === 0) {
    return [];
  }

  const candidates = await Promise.all(
    keys.map(key => kv.get<CandidateData>(key))
  );

  return candidates.filter((c): c is CandidateData => c !== null);
}

// ========================================
// RECORDING FUNCTIONS
// ========================================

export async function saveRecording(
  interviewId: string,
  candidateId: string,
  recording: Recording
): Promise<void> {
  const candidate = await getCandidate(interviewId, candidateId);
  
  if (!candidate) {
    throw new Error('Candidate not found');
  }

  const recordings = candidate.recordings || [];  
  
  const existingIndex = recordings.findIndex(
    (r: Recording) => r.question_index === recording.question_index
  );

  if (existingIndex >= 0) {
    recordings[existingIndex] = recording;
  } else {
    recordings.push(recording);
  }

  const key = `candidate:${interviewId}:${candidateId}`;
  
  // Only set status to 'recording' if it's currently 'registered'
  // This prevents overwriting 'submitted', 'scored', or 'terminated' status
  const updatedStatus = candidate.status === 'registered' 
    ? 'recording' as const 
    : candidate.status;

  await kv.set(key, {
    ...candidate,
    recordings,
    status: updatedStatus,
  });
}

export async function getRecordings(
  interviewId: string,
  candidateId: string
): Promise<Recording[]> {
  const candidate = await getCandidate(interviewId, candidateId);
  
  if (!candidate) {
    return [];
  }

  return candidate.recordings || [];
}

// ========================================
// RESULTS FUNCTIONS
// ========================================

export async function saveInterviewResults(
  interviewId: string,
  candidateId: string,
  results: InterviewResults
): Promise<void> {
  const candidate = await getCandidate(interviewId, candidateId);
  
  if (!candidate) {
    throw new Error('Candidate not found');
  }
  
  const key = `candidate:${interviewId}:${candidateId}`;
  
  await kv.set(key, {
    ...candidate,
    results,
    status: 'scored' as const,
  });
}

export async function getInterviewResults(
  interviewId: string,
  candidateId: string
): Promise<InterviewResults | null> {
  const candidate = await getCandidate(interviewId, candidateId);
  
  if (!candidate) {
    return null;
  }
  
  return candidate.results || null;
}

// ========================================
// VIOLATION FUNCTIONS
// ========================================

export async function saveViolation(
  interviewId: string,
  candidateId: string,
  violation: Violation
): Promise<void> {
  const candidate = await getCandidate(interviewId, candidateId);
  
  if (!candidate) {
    throw new Error('Candidate not found');
  }

  const violations = candidate.violations || [];
  violations.push(violation);

  const key = `candidate:${interviewId}:${candidateId}`;
  
  await kv.set(key, {
    ...candidate,
    violations,
  });
}

export async function getViolations(
  interviewId: string,
  candidateId: string
): Promise<Violation[]> {
  const candidate = await getCandidate(interviewId, candidateId);
  
  if (!candidate) {
    return [];
  }
  
  return candidate.violations || [];
}

// ========================================
// EXPORTS
// ========================================

export type { 
  InterviewData, 
  CandidateData, 
  Recording, 
  InterviewResults, 
  Violation
};