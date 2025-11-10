'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

interface CandidateResult {
  candidate_id: string;
  name: string;
  email: string;
  phone?: string;
  years_experience: number;
  salary_expectations: string;
  status: string;
  registered_at: string;
  overall_score?: number;
  top_strengths?: string[];
  areas_to_improve?: string[];
  processed_at?: string;
}

export default function ResultsPage({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const unwrappedParams = use(params);
  const interview_id = unwrappedParams.interview_id;

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [interviewTitle, setInterviewTitle] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'date'>('score');

  useEffect(() => {
    async function fetchResults() {
      try {
        const interviewResponse = await fetch(`/api/interview/${interview_id}`);
        if (interviewResponse.ok) {
          const interviewData = await interviewResponse.json();
          setInterviewTitle(interviewData.job_title);
        }

        const candidatesResponse = await fetch(`/api/interview/${interview_id}/candidates`);
        if (candidatesResponse.ok) {
          const candidatesData = await candidatesResponse.json();
          setCandidates(candidatesData.candidates || []);
        }
      } catch (error) {
        console.error('Failed to fetch results:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [interview_id]);

  const sortedCandidates = [...candidates].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return (b.overall_score || 0) - (a.overall_score || 0);
      case 'name':
        return a.name.localeCompare(b.name);
      case 'date':
        return new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime();
      default:
        return 0;
    }
  });

  const totalCandidates = candidates.length;
  const scoredCandidates = candidates.filter(c => c.overall_score).length;
  const averageScore = scoredCandidates > 0
    ? (candidates.reduce((sum, c) => sum + (c.overall_score || 0), 0) / scoredCandidates).toFixed(1)
    : 'N/A';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#667eea] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl shadow-lg p-8 mb-6 text-center">
          <div className="flex items-center justify-between">
            <div className="text-left flex-1">
              <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">{interviewTitle}</h1>
              <p className="text-white/90 text-base">Interview Results Dashboard</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all font-medium backdrop-blur-sm"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#667eea]">
            <p className="text-sm text-gray-600 font-semibold mb-2">Total Candidates</p>
            <p className="text-4xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">
              {totalCandidates}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 font-semibold mb-2">Scored</p>
            <p className="text-4xl font-bold text-green-600">{scoredCandidates}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-amber-500">
            <p className="text-sm text-gray-600 font-semibold mb-2">Average Score</p>
            <p className="text-4xl font-bold text-amber-600">{averageScore}/10</p>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 font-medium">Sort by:</span>
            <button
              onClick={() => setSortBy('score')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                sortBy === 'score'
                  ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Score
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                sortBy === 'name'
                  ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSortBy('date')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                sortBy === 'date'
                  ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Date
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {candidates.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg font-medium">No candidates yet</p>
              <p className="text-gray-400 text-sm mt-2">Results will appear here after candidates complete interviews</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Experience</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedCandidates.map((candidate) => (
                    <tr 
                      key={candidate.candidate_id}
                      className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 cursor-pointer transition-all"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{candidate.name}</div>
                        {candidate.top_strengths && candidate.top_strengths.length > 0 && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            ✓ {candidate.top_strengths[0]}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{candidate.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">{candidate.years_experience} years</td>
                      <td className="px-6 py-4">
                        {candidate.overall_score ? (
                          <div className="flex items-center">
                            <span className={`text-xl font-bold ${
                              candidate.overall_score >= 7
                                ? 'text-green-600'
                                : candidate.overall_score >= 5
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                              {candidate.overall_score.toFixed(1)}
                            </span>
                            <span className="text-gray-400 text-sm ml-1 font-medium">/10</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm font-medium">Processing...</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${
                          candidate.status === 'scored'
                            ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800'
                            : candidate.status === 'submitted'
                            ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800'
                            : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800'
                        }`}>
                          {candidate.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                        {new Date(candidate.registered_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <div className="inline-block bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-100 rounded-lg px-6 py-3">
            <p className="text-sm text-gray-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Full results are automatically exported to Google Sheets and emailed to recruiters
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}