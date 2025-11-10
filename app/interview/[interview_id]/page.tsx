import { notFound } from 'next/navigation';
import Link from 'next/link';

interface InterviewData {
  job_title: string;
  role_template: string;
  questions: string[];
  created_at: string;
  seniority?: string;
  work_model?: string;
  location?: string;
}

async function getInterviewData(interviewId: string): Promise<InterviewData | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/interview/${interviewId}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const { interview_id } = await params;
  const interview = await getInterviewData(interview_id);

  if (!interview) {
    notFound();
  }

  const questionCount = interview.questions.length;
  const estimatedMinutes = Math.ceil(questionCount * 4);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl shadow-lg p-10 mb-8 text-center">
          <h1 className="text-4xl font-semibold text-white mb-3 tracking-tight">
            {interview.job_title}
          </h1>
          <p className="text-xl text-white/90 mb-2">
            AI-Powered Video Interview
          </p>
          {interview.seniority && (
            <p className="text-sm text-white/80 mt-3">
              {interview.seniority} Level
              {interview.work_model && ` • ${interview.work_model}`}
              {interview.location && ` • ${interview.location}`}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <div className="mb-8 pb-8 border-b-2 border-gray-100">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Welcome! 👋
            </h2>
            <p className="text-gray-600 leading-relaxed text-base">
              Thank you for your interest in the <strong className="text-gray-800">{interview.job_title}</strong> position. 
              This AI-powered interview will help us understand your skills and experience better. 
              You'll have the opportunity to showcase your expertise through video responses.
            </p>
          </div>

          <div className="mb-8 pb-8 border-b-2 border-gray-100">
            <h3 className="text-xl font-semibold mb-5 text-gray-800">
              How it works:
            </h3>
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white rounded-full flex items-center justify-center font-semibold mr-4 shadow-sm">
                  1
                </span>
                <span className="text-gray-600 pt-1.5 leading-relaxed">
                  Complete a short registration form with your details
                </span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white rounded-full flex items-center justify-center font-semibold mr-4 shadow-sm">
                  2
                </span>
                <span className="text-gray-600 pt-1.5 leading-relaxed">
                  Answer {questionCount} questions via video (up to 3 minutes each)
                </span>
              </li>
              <li className="flex items-start">
                <span className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white rounded-full flex items-center justify-center font-semibold mr-4 shadow-sm">
                  3
                </span>
                <span className="text-gray-600 pt-1.5 leading-relaxed">
                  Submit your interview and we'll review it within 48 hours
                </span>
              </li>
            </ol>
          </div>

          <div className="mb-8 pb-8 border-b-2 border-gray-100">
            <h3 className="text-xl font-semibold mb-5 text-gray-800">
              What to expect:
            </h3>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 border-2 border-gray-200">
              <p className="text-gray-700 leading-relaxed mb-4">
                You'll be asked <strong className="text-gray-800">{questionCount} questions</strong> covering:
              </p>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-[#667eea] mr-3 font-bold text-lg">•</span>
                  <span className="pt-0.5">Your relevant work experience and background</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#667eea] mr-3 font-bold text-lg">•</span>
                  <span className="pt-0.5">Problem-solving and decision-making scenarios</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#667eea] mr-3 font-bold text-lg">•</span>
                  <span className="pt-0.5">Technical skills specific to the {interview.role_template} role</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#667eea] mr-3 font-bold text-lg">•</span>
                  <span className="pt-0.5">Situational questions related to daily responsibilities</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mb-6 p-5 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  className="w-6 h-6 text-[#667eea] mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-purple-900 font-semibold">
                  Estimated time: {estimatedMinutes}-{estimatedMinutes + 5} minutes
                </span>
              </div>
              <span className="text-purple-700 text-sm font-medium">
                {questionCount} questions
              </span>
            </div>
          </div>

          <div className="mb-6 p-5 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border-2 border-yellow-200">
            <h4 className="font-semibold text-yellow-900 mb-3 flex items-center text-base">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Before you start, please ensure:
            </h4>
            <ul className="space-y-2.5 text-yellow-800 text-sm">
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2 font-bold">✓</span>
                <span className="pt-0.5">You have a working camera and microphone</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2 font-bold">✓</span>
                <span className="pt-0.5">You're in a quiet, well-lit environment</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2 font-bold">✓</span>
                <span className="pt-0.5">You have a stable internet connection</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2 font-bold">✓</span>
                <span className="pt-0.5">You have about {estimatedMinutes}-{estimatedMinutes + 5} minutes available</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2 font-bold">✓</span>
                <span className="pt-0.5">You're using an updated browser (Chrome or Firefox recommended)</span>
              </li>
            </ul>
          </div>

          <div className="mb-8 p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
            <h4 className="font-semibold text-green-900 mb-3 flex items-center text-base">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Tips for success:
            </h4>
            <ul className="space-y-2.5 text-green-800 text-sm">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">💡</span>
                <span className="pt-0.5">Take a moment to think before answering each question</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">💡</span>
                <span className="pt-0.5">Speak clearly and look at the camera</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">💡</span>
                <span className="pt-0.5">Use specific examples from your experience</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">💡</span>
                <span className="pt-0.5">Be yourself and let your personality shine through</span>
              </li>
            </ul>
          </div>

          <div className="text-center">
            <Link
              href={`/interview/${interview_id}/register`}
              className="inline-block px-10 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-lg font-semibold rounded-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-100 shadow-lg"
            >
              Start Interview →
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              By continuing, you consent to being recorded during this interview
            </p>
          </div>
        </div>

        <div className="text-center text-sm text-gray-600">
          <p>
            Questions or technical issues?{' '}
            <a href="mailto:support@company.com" className="text-[#667eea] hover:text-[#764ba2] font-medium transition-colors">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const { interview_id } = await params;
  const interview = await getInterviewData(interview_id);

  if (!interview) {
    return {
      title: 'Interview Not Found',
    };
  }

  return {
    title: `${interview.job_title} - AI Interview`,
    description: `Complete your AI-powered interview for the ${interview.job_title} position`,
  };
}