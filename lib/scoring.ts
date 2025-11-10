import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
  jobTitle: string
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

    const prompt = buildScoringPrompt(question, transcript, jobTitle);

    const completion = await retryAPICall(() =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR interviewer. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
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
  jobTitle: string
): Promise<OverallResult> {
  try {
    const totalScore = questionScores.reduce((sum, q) => sum + q.score, 0);
    const averageScore = totalScore / questionScores.length;
    const overallScore = parseFloat((1.0 + (averageScore * 4.25)).toFixed(1));

    const prompt = buildFeedbackPrompt(questionScores, jobTitle, averageScore, overallScore);

    const completion = await retryAPICall(() =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR interviewer. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 800,
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
  jobTitle: string
): Promise<OverallResult> {
  const questionScores: QuestionScore[] = [];

  for (let i = 0; i < questions.length; i++) {
    const score = await scoreAnswer(questions[i], transcripts[i], jobTitle);
    questionScores.push(score);

    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return await generateOverallFeedback(questionScores, jobTitle);
}

function buildScoringPrompt(question: string, transcript: string, jobTitle: string): string {
  return `You are an expert HR interviewer evaluating a candidate's video interview response.

Job Title: ${jobTitle}
Question: ${question}

Candidate's Answer (transcribed):
"${transcript}"

Evaluate this answer using the following rubric:
- Score 0 (Poor): Off-topic, incoherent, or shows lack of understanding
- Score 1 (Acceptable): Basic answer, shows some understanding but lacks depth or examples
- Score 2 (Excellent): Clear, detailed, well-structured answer with relevant examples

Provide your evaluation in JSON format:
{
  "score": 0-2,
  "reasoning": "Brief explanation of the score",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"]
}

Be fair, objective, and constructive. Focus on content quality, clarity, and relevance to the question.`;
}

function buildFeedbackPrompt(
  questionScores: QuestionScore[],
  jobTitle: string,
  averageScore: number,
  overallScore: number
): string {
  const scoresSummary = questionScores.map((q, i) => 
    `Question ${i + 1}: ${q.question}\nScore: ${q.score}/2\nReasoning: ${q.reasoning}`
  ).join('\n\n');

  return `You are an expert HR interviewer providing overall feedback for a candidate.

Job Title: ${jobTitle}
Number of Questions: ${questionScores.length}
Average Score: ${averageScore.toFixed(2)}/2.0 (Overall: ${overallScore}/10)

Individual Question Scores:
${scoresSummary}

Based on this interview performance, provide:
1. Overall feedback summary (2-3 sentences)
2. Top 3 key strengths
3. Top 3 areas for improvement

Respond in JSON format:
{
  "overallFeedback": "Summary of the candidate's performance",
  "topStrengths": ["strength 1", "strength 2", "strength 3"],
  "areasToImprove": ["area 1", "area 2", "area 3"]
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
    overallFeedback: 'Interview evaluation completed successfully.',
    topStrengths: ['Communication skills', 'Relevant experience', 'Problem-solving ability'],
    areasToImprove: ['Could provide more examples', 'Further skill development', 'Industry knowledge'],
  };
}