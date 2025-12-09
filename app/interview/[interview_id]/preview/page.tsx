'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, use } from 'react';
import AudioVisualizer from '@/components/AudioVisualizer';

interface InterviewData {
  job_title: string;
  questions: string[];
}

export default function PreviewPage({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const unwrappedParams = use(params);
  const interview_id = unwrappedParams.interview_id;
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const candidateId = searchParams.get('candidate_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Redirect if no candidate_id
  useEffect(() => {
    if (!candidateId) {
      router.push(`/interview/${interview_id}/register`);
    }
  }, [candidateId, interview_id, router]);

  // Fetch interview data
  useEffect(() => {
    async function fetchInterview() {
      try {
        const response = await fetch(`/api/interview/${interview_id}`);
        if (!response.ok) throw new Error('Interview not found');
        const data = await response.json();
        setInterview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load interview');
      } finally {
        setLoading(false);
      }
    }
    if (candidateId) fetchInterview();
  }, [interview_id, candidateId]);

  // Setup camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true
        });

        setStream(mediaStream);
        setPermissionGranted(true);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setError('');
      } catch (err: any) {
        console.error("Preview Camera Error:", err.name, err.message);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera/microphone access denied. Please click the lock icon in your browser address bar to allow access.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found. Please connect a device.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is in use by another app (like Zoom) or blocked by macOS System Settings. Please close other apps and check System Settings > Privacy.');
        } else {
          setError(`System Error: ${err.message || 'Failed to access camera/microphone'}`);
        }
      }
    }

    setupCamera();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleContinue = () => {
    if (!permissionGranted) {
      setError('Please allow camera and microphone access before continuing.');
      return;
    }
    if (stream) stream.getTracks().forEach(track => track.stop());
    
    router.push(`/interview/${interview_id}/practice?candidate_id=${candidateId}`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (error && !interview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href={`/interview/${interview_id}`} className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg">Back to Interview</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl shadow-lg p-8 mb-8 text-center">
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">{interview?.job_title}</h1>
          <p className="text-white/90 text-lg">Camera & Microphone Check</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          {/* Camera Preview Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-6 h-6 text-[#667eea] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Camera Preview
            </h2>
            
            <div className="relative w-full bg-black rounded-lg overflow-hidden shadow-inner aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute top-0 left-0 w-full h-full object-cover transform scale-x-[-1]"
              />
              
              {/* Audio Visualizer Overlay */}
              {permissionGranted && stream && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-2/3 z-20">
                   <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                      <p className="text-xs text-center text-white/80 mb-1">Microphone Check</p>
                      <AudioVisualizer stream={stream} />
                   </div>
                </div>
              )}

              {!stream && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white">Requesting camera access...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 p-6 z-30">
                  <div className="text-center">
                    <div className="text-red-500 text-4xl mb-4">⚠️</div>
                    <h3 className="text-white font-bold mb-2">Access Failed</h3>
                    <p className="text-gray-300 text-sm mb-4">{error}</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-white text-black text-sm rounded-full font-medium hover:bg-gray-200"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {permissionGranted && (
                <div className="absolute top-4 left-4 flex items-center space-x-2 bg-green-600 text-white px-3 py-1.5 rounded-full text-sm">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="font-medium">System Ready</span>
                </div>
              )}
            </div>

            {permissionGranted && (
              <div className="mt-3 p-4 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg text-center">
                <p className="text-green-800 text-sm font-medium">
                  ✓ Great! Your camera and microphone are working properly.
                </p>
              </div>
            )}
          </div>

          {/* Interview Rules - CLEAN VERSION */}
          <div className="mb-8 space-y-4">
            
            {/* Basic Rules Section */}
            <div className="p-6 bg-white rounded-lg border-2 border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center text-lg">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Interview Rules
              </h3>
              
              <div className="space-y-3 text-gray-700 text-sm">
                <div className="flex items-start p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-blue-600 mr-3 font-bold text-lg">👉</span>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">First: Practice Mode</p>
                    <p className="text-gray-600">One ungraded practice question to get comfortable before the real interview.</p>
                  </div>
                </div>
                
                <div className="flex items-start pl-3">
                  <span className="text-gray-400 mr-3 font-bold">•</span>
                  <p><strong className="text-gray-900">Real Interview:</strong> No retakes once started.</p>
                </div>
                
                <div className="flex items-start pl-3">
                  <span className="text-gray-400 mr-3 font-bold">•</span>
                  <p><strong className="text-gray-900">Auto-Start:</strong> Recording begins when countdown hits zero.</p>
                </div>
              </div>
            </div>

            {/* Proctoring Warning Section */}
            <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border-2 border-red-200">
              <div className="flex items-start mb-4">
                <span className="text-red-600 mr-3 text-2xl">🚨</span>
                <div>
                  <h4 className="font-bold text-red-900 text-lg">3-Strike Monitoring System</h4>
                  <p className="text-red-800 mt-1">
                    AI monitors your behavior during the interview. <strong>3 strikes = automatic termination</strong> and disqualification.
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-white/60 rounded-lg">
                <p className="font-semibold text-gray-900 mb-2 text-sm">Monitored Behaviors:</p>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">→</span>
                    Tab switching or leaving the interview window
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">→</span>
                    Face not visible for 10+ seconds
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">→</span>
                    Multiple people detected in camera frame
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">→</span>
                    Looking away from camera repeatedly
                  </li>
                </ul>
              </div>
              
              <div className="mt-4 p-3 bg-white/80 rounded-lg border border-red-300">
                <p className="text-sm text-gray-800">
                  <strong className="text-red-900">⚖️ Fair Warning:</strong> Clear warnings for Strike 1 & 2. Strike 3 immediately ends your interview.
                </p>
              </div>
            </div>
            
          </div>

          {/* Continue Button */}
          <div className="text-center">
            <button
              onClick={handleContinue}
              disabled={!permissionGranted}
              className="px-10 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-lg font-semibold rounded-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-100 shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:transform-none"
            >
              {permissionGranted ? 'Continue to Practice Mode →' : 'Waiting for camera access...'}
            </button>
            
            {permissionGranted && (
              <p className="mt-4 text-sm text-gray-500">
                You won't be graded yet. This is just a system check.
              </p>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <a href={`/interview/${interview_id}/register`} className="text-sm text-gray-600 hover:text-[#667eea] font-medium transition-colors">
            ← Back to registration
          </a>
        </div>
      </div>
    </div>
  );
}