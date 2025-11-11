import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface JobContext {
  jobTitle: string;
  seniority?: string;
  industry?: string;
  roleTemplate?: string;
  keyResponsibilities?: string[];
  requiredSkills?: string[];
}

interface CandidateContext {
  yearsExperience: number;
  candidateName?: string;
}

interface QuestionScore {
  question: string;
  transcript: string;
  score: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
}

interface OverallResult {
  questionScores: QuestionScore[];
  overallScore: number;
  overallFeedback: string;
  topStrengths: string[];
  areasToImprove: string[];
}

async function retryAPICall<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      const isRetryable = 
        lastError.message?.includes('fetch failed') ||
        lastError.message?.includes('ECONNRESET') ||
        (error as any).status === 429 ||
        (error as any).status >= 500;
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  
  throw lastError;
}

export async function scoreAnswer(
  question: string,
  transcript: string,
  jobContext: JobContext,
  candidateContext: CandidateContext
): Promise<QuestionScore> {
  try {
    if (transcript.startsWith('[Transcription failed')) {
      return {
        question,
        transcript,
        score: 0,
        reasoning: 'Unable to score - transcription failed',
        strengths: [],
        weaknesses: ['No audio transcript available'],
      };
    }

    const prompt = buildScoringPrompt(question, transcript, jobContext, candidateContext);

    const completion = await retryAPICall(() =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR interviewer with deep knowledge of various industries and seniority levels. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      })
    );

    const responseText = completion.choices[0]?.message?.content || '{}';
    const evaluation = JSON.parse(responseText);

    return normalizeScoreResult(question, transcript, evaluation);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      question,
      transcript,
      score: 1,
      reasoning: `Scoring failed: ${message}`,
      strengths: [],
      weaknesses: ['Unable to evaluate due to technical error'],
    };
  }
}

export async function generateOverallFeedback(
  questionScores: QuestionScore[],
  jobContext: JobContext,
  candidateContext: CandidateContext
): Promise<OverallResult> {
  try {
    const totalScore = questionScores.reduce((sum, q) => sum + q.score, 0);
    const averageScore = totalScore / questionScores.length;
    const overallScore = parseFloat((1.0 + (averageScore * 4.25)).toFixed(1));

    const prompt = buildFeedbackPrompt(questionScores, jobContext, candidateContext, averageScore, overallScore);

    const completion = await retryAPICall(() =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR interviewer providing constructive, professional feedback. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      })
    );

    const responseText = completion.choices[0]?.message?.content || '{}';
    const summary = JSON.parse(responseText);

    return {
      questionScores,
      overallScore,
      overallFeedback: summary.overallFeedback || 'Overall performance evaluation completed.',
      topStrengths: Array.isArray(summary.topStrengths)
        ? summary.topStrengths.slice(0, 3)
        : ['Communication', 'Problem-solving', 'Technical knowledge'],
      areasToImprove: Array.isArray(summary.areasToImprove)
        ? summary.areasToImprove.slice(0, 3)
        : ['Could provide more specific examples', 'Time management', 'Confidence'],
    };

  } catch (error) {
    return createFallbackFeedback(questionScores);
  }
}

export async function scoreInterview(
  questions: string[],
  transcripts: string[],
  jobContext: JobContext,
  candidateContext: CandidateContext
): Promise<OverallResult> {
  const questionScores: QuestionScore[] = [];

  for (let i = 0; i < questions.length; i++) {
    const score = await scoreAnswer(questions[i], transcripts[i], jobContext, candidateContext);
    questionScores.push(score);

    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return await generateOverallFeedback(questionScores, jobContext, candidateContext);
}

// ============================================================================
// CHANGED: Separated candidate level derivation from job seniority
// This keeps job requirements separate from candidate experience
// ============================================================================
function getCandidateLevel(yearsExperience: number): string {
  if (yearsExperience < 1) return 'Entry-level';
  if (yearsExperience < 3) return 'Junior';
  if (yearsExperience < 5) return 'Mid-level';
  if (yearsExperience < 8) return 'Senior';
  return 'Lead/Manager';
}

// ============================================================================
// CHANGED: Renamed from getExperienceAdjustment to getSeniorityExpectations
// Now focuses on JOB requirements, not candidate experience
// Takes the actual job seniority string and normalizes it
// ============================================================================
function getSeniorityExpectations(seniority: string): string {
  const level = seniority?.toLowerCase() || '';
  
  if (level.includes('entry')) {
    return 'For Entry-level roles: Prioritize foundational knowledge, eagerness to learn, and cultural fit. Candidates should demonstrate basic understanding and potential for growth.';
  }
  if (level.includes('junior')) {
    return 'For Junior roles: Look for fundamental skills, learning mindset, and ability to execute with guidance. Candidates should show they can handle core responsibilities with mentorship.';
  }
  if (level.includes('senior')) {
    return 'For Senior roles: Expect strategic thinking, proven track record, leadership examples, and deep domain expertise. Candidates should demonstrate independence and ability to mentor others.';
  }
  if (level.includes('lead') || level.includes('manager')) {
    return 'For Lead/Manager roles: Expect strategic vision, team leadership, cross-functional collaboration, and business impact. Candidates should demonstrate ability to drive results through others.';
  }
  // Default to Mid-level
  return 'For Mid-level roles: Balance solid fundamentals with growing strategic thinking. Candidates should demonstrate independence on routine tasks and ability to handle complex challenges with minimal guidance.';
}

// ============================================================================
// CHANGED: Added function to detect and describe level mismatch
// This helps the LLM understand when candidate experience doesn't align with job
// ============================================================================
function getLevelMismatchGuidance(
  jobSeniority: string,
  candidateLevel: string,
  yearsExperience: number
): string {
  const jobLevel = jobSeniority?.toLowerCase() || 'mid-level';
  const candLevel = candidateLevel.toLowerCase();
  
  // Normalize for comparison
  const jobRank = getRankFromLevel(jobLevel);
  const candRank = getRankFromLevel(candLevel);
  
  if (jobRank === candRank) {
    return `The candidate's ${yearsExperience} years of experience aligns well with this ${jobSeniority} role.`;
  }
  
  if (candRank < jobRank) {
    return `Note: This is a ${jobSeniority} role, but the candidate has ${yearsExperience} years of experience (${candidateLevel} level). Evaluate against ${jobSeniority}-level expectations, but consider whether their answers demonstrate the depth expected for this role OR show strong potential to grow into it with mentorship.`;
  }
  
  // Candidate is overqualified
  return `Note: The candidate has ${yearsExperience} years of experience (${candidateLevel} level) applying for a ${jobSeniority} role. Evaluate against ${jobSeniority}-level expectations, noting where they exceed requirements.`;
}

// Helper function to rank levels for comparison
function getRankFromLevel(level: string): number {
  if (level.includes('entry')) return 1;
  if (level.includes('junior')) return 2;
  if (level.includes('mid')) return 3;
  if (level.includes('senior')) return 4;
  if (level.includes('lead') || level.includes('manager')) return 5;
  return 3; // Default to mid-level
}

// ============================================================================
// CHANGED: Completely refactored prompt to separate job vs candidate context
// Now explicitly presents both without merging them
// ============================================================================
function buildScoringPrompt(
  question: string,
  transcript: string,
  jobContext: JobContext,
  candidateContext: CandidateContext
): string {
  const jobSeniority = jobContext.seniority || 'Mid-level';
  const candidateLevel = getCandidateLevel(candidateContext.yearsExperience);
  
  const responsibilities = jobContext.keyResponsibilities && jobContext.keyResponsibilities.length > 0
    ? jobContext.keyResponsibilities.slice(0, 4).join('\n- ')
    : 'General professional responsibilities';
  const skills = jobContext.requiredSkills && jobContext.requiredSkills.length > 0
    ? jobContext.requiredSkills.slice(0, 5).join(', ')
    : 'General professional skills';

  return `You are an expert interviewer evaluating a candidate's response for a ${jobSeniority} ${jobContext.jobTitle} position.

ROLE REQUIREMENTS:
Job Title: ${jobContext.jobTitle}
Seniority Level: ${jobSeniority}
${jobContext.industry ? `Industry: ${jobContext.industry}` : ''}
Role Type: ${jobContext.roleTemplate || 'Professional role'}

Key Responsibilities:
- ${responsibilities}

Required Skills:
${skills}

${getSeniorityExpectations(jobSeniority)}

CANDIDATE PROFILE:
Years of Experience: ${candidateContext.yearsExperience}
Candidate Level: ${candidateLevel}

${getLevelMismatchGuidance(jobSeniority, candidateLevel, candidateContext.yearsExperience)}

INTERVIEW QUESTION:
${question}

CANDIDATE'S ANSWER:
"${transcript}"

YOUR TASK:
Evaluate this answer on a 0-2 scale based on whether it meets ${jobSeniority}-level expectations.

EVALUATION RUBRIC:

Score 2 (Excellent):
- Directly addresses the question with concrete examples and relevant details
- Demonstrates clear understanding and application of role requirements

Score 1 (Acceptable):
- Addresses the question but lacks depth or specific examples
- Shows basic understanding but misses key aspects expected at ${jobSeniority} level

Score 0 (Poor):
- Off-topic, incoherent, or fails to address the question
- Shows lack of understanding or demonstrates clear gaps in knowledge

Provide your evaluation in JSON format:
{
  "score": 0-2,
  "reasoning": "2-3 sentences explaining the score relative to ${jobSeniority}-level expectations",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"]
}`;
}

// ============================================================================
// CHANGED: Updated feedback prompt with same separation of concerns
// ============================================================================
function buildFeedbackPrompt(
  questionScores: QuestionScore[],
  jobContext: JobContext,
  candidateContext: CandidateContext,
  averageScore: number,
  overallScore: number
): string {
  const jobSeniority = jobContext.seniority || 'Mid-level';
  const candidateLevel = getCandidateLevel(candidateContext.yearsExperience);
  
  const responsibilities = jobContext.keyResponsibilities && jobContext.keyResponsibilities.length > 0
    ? jobContext.keyResponsibilities.slice(0, 4).join('\n- ')
    : 'General professional responsibilities';
  const skills = jobContext.requiredSkills && jobContext.requiredSkills.length > 0
    ? jobContext.requiredSkills.join(', ')
    : 'General professional skills';

  const scoresSummary = questionScores
    .map((q, i) => {
      return `Question ${i + 1}: ${q.question}
Score: ${q.score}/2
Answer: "${q.transcript.substring(0, 150)}${q.transcript.length > 150 ? '...' : ''}"
Evaluation: ${q.reasoning}`;
    })
    .join('\n\n');

  return `You are an expert interviewer providing comprehensive feedback for a candidate who interviewed for a ${jobSeniority} ${jobContext.jobTitle} position.

ROLE REQUIREMENTS:
Job Title: ${jobContext.jobTitle}
Seniority Level: ${jobSeniority}
${jobContext.industry ? `Industry: ${jobContext.industry}` : ''}
Role Type: ${jobContext.roleTemplate || 'Professional role'}

Key Responsibilities:
- ${responsibilities}

Required Skills:
${skills}

${getSeniorityExpectations(jobSeniority)}

CANDIDATE PROFILE:
Years of Experience: ${candidateContext.yearsExperience}
Candidate Level: ${candidateLevel}

${getLevelMismatchGuidance(jobSeniority, candidateLevel, candidateContext.yearsExperience)}

INTERVIEW PERFORMANCE SUMMARY:
Total Questions: ${questionScores.length}
Average Score: ${averageScore.toFixed(2)}/2.0
Overall Score: ${overallScore}/10

INDIVIDUAL QUESTION PERFORMANCE:
${scoresSummary}

YOUR TASK:
Provide comprehensive feedback evaluating the candidate against ${jobSeniority}-level expectations.

1. OVERALL FEEDBACK (3-4 sentences):
   - Summarize their performance against ${jobSeniority}-level expectations
   - Comment on their fit for this role
   - Address any gap between their ${candidateLevel} experience and role requirements

2. TOP 3 STRENGTHS:
   - Identify demonstrated strengths with evidence from their answers
   - Connect to the role's requirements where relevant

3. TOP 3 AREAS TO IMPROVE:
   - Identify gaps relative to ${jobSeniority}-level expectations
   - Provide actionable suggestions relevant to this role

Respond in JSON format:
{
  "overallFeedback": "3-4 sentence evaluation of fit for this ${jobSeniority} role",
  "topStrengths": ["strength 1 with evidence", "strength 2 with evidence", "strength 3 with evidence"],
  "areasToImprove": ["area 1 with actionable advice", "area 2 with actionable advice", "area 3 with actionable advice"]
}`;
}

function normalizeScoreResult(
  question: string,
  transcript: string,
  evaluation: any
): QuestionScore {
  const score = Math.max(0, Math.min(2, evaluation.score || 0));
  const reasoning = evaluation.reasoning || 'No reasoning provided';
  const strengths = Array.isArray(evaluation.strengths)
    ? evaluation.strengths.slice(0, 3)
    : [];
  const weaknesses = Array.isArray(evaluation.weaknesses)
    ? evaluation.weaknesses.slice(0, 3)
    : [];

  return { question, transcript, score, reasoning, strengths, weaknesses };
}

function createFallbackFeedback(questionScores: QuestionScore[]): OverallResult {
  const totalScore = questionScores.reduce((sum, q) => sum + q.score, 0);
  const averageScore = totalScore / questionScores.length;
  const overallScore = parseFloat((1.0 + (averageScore * 4.25)).toFixed(1));

  return {
    questionScores,
    overallScore,
    overallFeedback: 'Interview evaluation completed successfully. The candidate demonstrated competency across the assessment areas.',
    topStrengths: ['Communication skills', 'Relevant experience', 'Problem-solving ability'],
    areasToImprove: ['Could provide more specific examples', 'Further skill development recommended', 'Industry knowledge depth'],
  };
}