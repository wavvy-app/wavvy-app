'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

interface CandidateData {
  name: string;
  email: string;
  status?: string;
}

interface InterviewData {
  job_title: string;
  questions: string[];
}

export default function TerminatedPage({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const unwrappedParams = use(params);
  const interview_id = unwrappedParams.interview_id;

  const searchParams = useSearchParams();
  const candidateId = searchParams.get('candidate_id');
  const reason = searchParams.get('reason');
  
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const initializationStarted = useRef(false);

  useEffect(() => {
    async function initialize() {
      if (!candidateId) {
        setLoading(false);
        return;
      }

      if (initializationStarted.current) return;
      initializationStarted.current = true;

      try {
        const candidateResponse = await fetch(
          `/api/interview/${interview_id}/candidate?candidate_id=${candidateId}`
        );
        
        if (!candidateResponse.ok) {
          throw new Error('Failed to fetch candidate data');
        }

        const candidateData: CandidateData = await candidateResponse.json();
        setCandidate(candidateData);

        const interviewResponse = await fetch(`/api/interview/${interview_id}`);
        if (interviewResponse.ok) {
          const interviewData = await interviewResponse.json();
          setInterview(interviewData);
        }

        if (candidateData.status !== 'terminated') {
          try {
            await fetch(`/api/interview/${interview_id}/candidate/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                candidate_id: candidateId,
                status: 'terminated',
              }),
            });
          } catch (statusError) {
            console.error('Status update failed:', statusError);
          }
        }
        
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [interview_id, candidateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Interview Terminated
          </h1>
          
          {candidate && (
            <p className="text-xl text-gray-600 mb-8">
              Sorry, <span className="font-semibold text-gray-800">{candidate.name}</span>.
            </p>
          )}

          {interview && (
            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg p-5 mb-8 border-2 border-red-100">
              <p className="text-sm text-gray-600 mb-1">Position Applied For</p>
              <p className="text-lg font-semibold text-gray-900">{interview.job_title}</p>
            </div>
          )}

          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-6 mb-8 border-2 border-gray-200">
            <p className="text-gray-800 leading-relaxed">
              Your interview has been ended due to proctoring policy violations.
            </p>
            <p className="text-gray-700 mt-3 leading-relaxed">
              Our monitoring system detected behavior that violated our interview guidelines, 
              which all candidates must follow.
            </p>
          </div>

          <div className="border-t-2 border-gray-100 my-8"></div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border-2 border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Technical Error?
            </h3>
            <p className="text-blue-800 text-sm mb-3">
              If you believe this was a technical error or system malfunction, 
              please contact our support team.
            </p>
            {candidateId && (
              <p className="text-blue-700 text-xs font-mono bg-blue-100 rounded px-3 py-2 inline-block">
                Candidate ID: {candidateId.slice(0, 8)}
              </p>
            )}
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-6 border-2 border-purple-100">
            <h3 className="font-semibold text-purple-900 mb-2 flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Need Help?
            </h3>
            <p className="text-purple-800 text-sm mb-3">
              Contact our support team at{' '}
              <a 
                href="mailto:support@company.com" 
                className="font-semibold text-purple-900 hover:text-purple-700 underline transition-colors"
              >
                support@company.com
              </a>
            </p>
            {candidate && (
              <p className="text-purple-700 text-xs">
                Include your Candidate ID and we'll review your case.
              </p>
            )}
          </div>

          <div className="border-t-2 border-gray-100 my-8"></div>

          <p className="text-lg text-gray-500 mt-8 font-medium">
            You can safely close this tab now
          </p>
        </div>

        <div className="text-center mt-8 text-sm text-gray-600">
          <p>
            Questions about this decision?{' '}
            <a href="mailto:support@company.com" className="text-[#667eea] hover:text-[#764ba2] font-medium transition-colors">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}