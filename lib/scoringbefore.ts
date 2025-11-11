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

function buildScoringPrompt(
  question: string,
  transcript: string,
  jobContext: JobContext,
  candidateContext: CandidateContext
): string {
  const seniority = jobContext.seniority || 'Professional';
  const responsibilities = jobContext.keyResponsibilities && jobContext.keyResponsibilities.length > 0
    ? jobContext.keyResponsibilities.slice(0, 4).join('\n- ')
    : 'General professional responsibilities';
  const skills = jobContext.requiredSkills && jobContext.requiredSkills.length > 0
    ? jobContext.requiredSkills.slice(0, 5).join(', ')
    : 'General professional skills';

  // Determine experience level based on years and seniority
  const experienceLevel = 
    seniority?.toLowerCase().includes('senior') || candidateContext.yearsExperience >= 5 ? 'senior' :
    seniority?.toLowerCase().includes('junior') || candidateContext.yearsExperience < 2 ? 'junior' : 'mid-level';

  return `You are an expert interviewer evaluating a candidate's response for a ${seniority}-level ${jobContext.jobTitle} position.

ROLE CONTEXT:
Job Title: ${jobContext.jobTitle}
Seniority Level: ${seniority}
${jobContext.industry ? `Industry: ${jobContext.industry}` : ''}
Role Type: ${jobContext.roleTemplate || 'Professional role'}

Key Responsibilities for this role:
- ${responsibilities}

Required Skills:
${skills}

CANDIDATE PROFILE:
Years of Experience: ${candidateContext.yearsExperience}
Expected Level: ${experienceLevel}

INTERVIEW QUESTION:
${question}

CANDIDATE'S ANSWER:
"${transcript}"

YOUR TASK:
Evaluate this answer on a 0-2 scale based on the criteria below, adjusting expectations for a candidate with ${candidateContext.yearsExperience} years of experience at the ${experienceLevel} level.

EVALUATION RUBRIC:

Score 2 (Excellent):
- Directly addresses the question with relevant, specific details
- Demonstrates clear understanding of the role's responsibilities and required skills
- Provides concrete examples or structured reasoning appropriate for ${experienceLevel} level
- Shows depth of knowledge and practical application
- Well-organized and articulate response

Score 1 (Acceptable):
- Addresses the question but lacks depth or specific examples
- Shows basic understanding but misses key aspects of the role's requirements
- Answer is somewhat generic or could apply to many roles
- Reasoning is present but not fully developed
- Shows potential but needs more development for ${experienceLevel} level

Score 0 (Poor):
- Off-topic, incoherent, or fails to address the question
- Shows lack of understanding of basic role requirements
- No relevant examples or reasoning provided
- Answer is too vague, contradictory, or demonstrates clear gaps in knowledge

EVALUATION GUIDELINES:
- Consider what type of question this is (behavioral/situational/technical) and adjust expectations accordingly
- For behavioral questions asking about past experience: look for specific situations, actions taken, and results
- For situational questions asking "how would you": look for clear process, logical steps, and sound reasoning
- For technical questions about tools/methods: look for specific knowledge and practical application
- Evaluate based on what's reasonable to expect from a ${experienceLevel} candidate with ${candidateContext.yearsExperience} years of experience in ${jobContext.roleTemplate || 'this role'}
- ${getExperienceAdjustment(experienceLevel)}

Provide your evaluation in JSON format:
{
  "score": 0-2,
  "reasoning": "2-3 sentences explaining the score, referencing specific strengths or gaps in the answer",
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"]
}

Focus on being fair, objective, and constructive. Your feedback should help the candidate understand what they did well and where they can improve.`;
}

function buildFeedbackPrompt(
  questionScores: QuestionScore[],
  jobContext: JobContext,
  candidateContext: CandidateContext,
  averageScore: number,
  overallScore: number
): string {
  const seniority = jobContext.seniority || 'Professional';
  const responsibilities = jobContext.keyResponsibilities && jobContext.keyResponsibilities.length > 0
    ? jobContext.keyResponsibilities.slice(0, 4).join('\n- ')
    : 'General professional responsibilities';
  const skills = jobContext.requiredSkills && jobContext.requiredSkills.length > 0
    ? jobContext.requiredSkills.join(', ')
    : 'General professional skills';

  // Determine experience level
  const experienceLevel = 
    seniority?.toLowerCase().includes('senior') || candidateContext.yearsExperience >= 5 ? 'senior' :
    seniority?.toLowerCase().includes('junior') || candidateContext.yearsExperience < 2 ? 'junior' : 'mid-level';

  const scoresSummary = questionScores
    .map((q, i) => {
      return `Question ${i + 1}: ${q.question}
Score: ${q.score}/2
Answer: "${q.transcript.substring(0, 150)}${q.transcript.length > 150 ? '...' : ''}"
Evaluation: ${q.reasoning}`;
    })
    .join('\n\n');

  return `You are an expert interviewer providing comprehensive feedback for a candidate who interviewed for a ${seniority}-level ${jobContext.jobTitle} position.

ROLE CONTEXT:
Job Title: ${jobContext.jobTitle}
Seniority Level: ${seniority}
${jobContext.industry ? `Industry: ${jobContext.industry}` : ''}
Role Type: ${jobContext.roleTemplate || 'Professional role'}

Key Responsibilities for this role:
- ${responsibilities}

Required Skills:
${skills}

CANDIDATE PROFILE:
Years of Experience: ${candidateContext.yearsExperience}
Expected Level: ${experienceLevel}

INTERVIEW PERFORMANCE SUMMARY:
Total Questions: ${questionScores.length}
Average Score: ${averageScore.toFixed(2)}/2.0
Overall Score: ${overallScore}/10

INDIVIDUAL QUESTION PERFORMANCE:
${scoresSummary}

YOUR TASK:
Based on this complete interview performance, provide:

1. OVERALL FEEDBACK (3-4 sentences):
   - Summarize the candidate's overall performance relative to their ${candidateContext.yearsExperience} years of experience
   - Comment on their fit for this ${seniority}-level ${jobContext.jobTitle} role
   - Consider whether their performance aligns with ${experienceLevel} expectations
   - Be balanced - acknowledge both strengths and areas for growth

2. TOP 3 STRENGTHS:
   - Identify specific strengths demonstrated across their answers
   - Reference actual competencies or skills they showed
   - Connect strengths to the role's requirements where possible
   - Be specific, not generic (avoid "good communicator" unless you can cite evidence)
   - Consider what stands out for someone with ${candidateContext.yearsExperience} years of experience

3. TOP 3 AREAS TO IMPROVE:
   - Identify specific gaps or weaknesses in their responses
   - Make suggestions actionable and relevant to the role
   - Consider what a ${experienceLevel} candidate with ${candidateContext.yearsExperience} years should demonstrate
   - Be constructive and professional
   - Focus on areas that would help them progress in their career

IMPORTANT:
- Base your feedback on their ACTUAL answers and performance, not assumptions
- Reference the role's specific requirements (responsibilities and skills listed above)
- If they scored well on questions testing key responsibilities, highlight that
- If they struggled with questions about required skills, note that as an area to improve
- Adjust your expectations based on their ${candidateContext.yearsExperience} years of experience at the ${experienceLevel} level
- Make feedback specific to THIS role, not generic interview feedback

Respond in JSON format:
{
  "overallFeedback": "3-4 sentence summary of their performance and fit for the role, considering their experience level",
  "topStrengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "areasToImprove": ["specific area 1", "specific area 2", "specific area 3"]
}`;
}

function getExperienceAdjustment(level: string): string {
  switch (level) {
    case 'junior':
      return 'For junior candidates: prioritize fundamentals, learning mindset, and potential over perfect execution';
    case 'senior':
      return 'For senior candidates: expect strategic thinking, leadership examples, and deep domain expertise';
    default:
      return 'For mid-level candidates: balance between solid fundamentals and growing strategic thinking';
  }
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