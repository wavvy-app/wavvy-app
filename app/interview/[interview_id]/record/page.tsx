'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoRecorder from '@/components/VideoRecorder';
import { useInterviewProctoring } from '@/hooks/useInterviewProctoring';
import ProctoringNotification from '@/components/proctoring/ProctoringNotification';

interface InterviewData {
  job_title: string;
  questions: string[];
}

interface CandidateData {}

interface FailedUpload {
  blob: Blob;
  questionIndex: number;
  attempts: number;
}

export default function RecordPage({
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
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [backgroundUploadError, setBackgroundUploadError] = useState('');

  const [countdownSeconds, setCountdownSeconds] = useState(30);
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [canRecord, setCanRecord] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [remainingGlobalTime, setRemainingGlobalTime] = useState<number | null>(null);

  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [retryingUploads, setRetryingUploads] = useState(false);

  const advanceRef = useRef(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const globalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const proctoringVideoRef = useRef<HTMLVideoElement>(null);

  const handleTerminated = useCallback(() => {
    router.push(
      `/interview/${interview_id}/terminated?candidate_id=${candidateId}&reason=violations`
    );
  }, [router, interview_id, candidateId]);

  const handleViolationLogged = useCallback(async (violation: any) => {
    try {
      await fetch(`/api/interview/${interview_id}/violations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          violation
        })
      });
    } catch (error) {
      console.error('Failed to log violation:', error);
    }
  }, [interview_id, candidateId]);

  const proctoring = useInterviewProctoring({
    video: proctoringVideoRef.current,
    isActive: canRecord && !isCountingDown,
    onTerminated: handleTerminated,
    maxStrikes: 3,
    interviewId: interview_id,
    candidateId: candidateId || undefined,
    onViolationLogged: handleViolationLogged
  });

  useEffect(() => {
    if (!candidateId) {
      router.push(`/interview/${interview_id}/register`);
    }
  }, [candidateId, interview_id, router]);

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (interview && remainingGlobalTime === null) {
      const TIME_PER_QUESTION = 300;
      const totalTime = interview.questions.length * TIME_PER_QUESTION;
      setRemainingGlobalTime(totalTime);
    }

    if (remainingGlobalTime !== null && remainingGlobalTime > 0) {
      globalTimerRef.current = setInterval(() => {
        setRemainingGlobalTime(prev => {
          if (prev === null || prev <= 0) {
            if (globalTimerRef.current) clearInterval(globalTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (globalTimerRef.current) clearInterval(globalTimerRef.current);
    };
  }, [interview, remainingGlobalTime]);

  useEffect(() => {
    if (remainingGlobalTime === 0) {
      router.push(`/interview/${interview_id}/complete?candidate_id=${candidateId}&reason=timeout`);
    }
  }, [remainingGlobalTime, router, interview_id, candidateId]);

  useEffect(() => {
    if (interview && candidate) {
      const currentQuestion = interview.questions[currentQuestionIndex];
      const words = currentQuestion.split(' ').length;
      const readingTime = Math.ceil(words / 3) + 5;
      setCountdownSeconds(readingTime);
    } else {
      setCountdownSeconds(30);
    }

    setIsCountingDown(true);
    setCanRecord(false);
    setRecordedBlob(null);
    setAutoAdvancing(false);
    setUploading(false);
    advanceRef.current = false;

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setIsCountingDown(false);
          setCanRecord(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [currentQuestionIndex, interview, candidate]);

  useEffect(() => {
    async function fetchData() {
      try {
        const interviewResponse = await fetch(`/api/interview/${interview_id}`);
        if (!interviewResponse.ok) throw new Error('Interview not found');
        const interviewData = await interviewResponse.json();
        setInterview(interviewData);

        const candidateResponse = await fetch(
          `/api/interview/${interview_id}/candidate?candidate_id=${candidateId}`
        );
        if (!candidateResponse.ok) throw new Error('Candidate not found');
        const candidateData = await candidateResponse.json();
        setCandidate(candidateData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    if (candidateId) fetchData();
  }, [interview_id, candidateId]);

  const uploadVideo = useCallback(async (blob: Blob, questionIndex: number): Promise<boolean> => {
    try {
      const fileExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const timestamp = Date.now();
      const filename = `interviews/${interview_id}/${candidateId}/question-${questionIndex}-${timestamp}.${fileExtension}`;
      
      const { upload } = await import('@vercel/blob/client');
      
      const result = await upload(filename, blob, {
        access: 'public',
        handleUploadUrl: `/api/interview/${interview_id}/upload?candidate_id=${candidateId}&question_index=${questionIndex}`,
      });

      const saveResponse = await fetch(`/api/interview/${interview_id}/save-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          question_index: questionIndex,
          video_url: result.url,
          duration: 0,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save recording metadata');
      }

      setUploadedCount(prev => prev + 1);
      return true;
    } catch (err) {
      console.error('Upload error:', err);
      return false;
    }
  }, [interview_id, candidateId]);

  const retryFailedUploads = useCallback(async () => {
    if (retryingUploads || failedUploads.length === 0) return;
    
    setRetryingUploads(true);
    const uploadsToRetry = [...failedUploads];
    const stillFailed: FailedUpload[] = [];

    for (const failed of uploadsToRetry) {
      if (failed.attempts >= 3) {
        stillFailed.push(failed);
        continue;
      }
      const delay = Math.min(1000 * Math.pow(2, failed.attempts - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));

      const success = await uploadVideo(failed.blob, failed.questionIndex);
      if (!success) {
        stillFailed.push({ ...failed, attempts: failed.attempts + 1 });
      }
    }

    setFailedUploads(stillFailed);
    setRetryingUploads(false);
    if (stillFailed.length > 0) {
      setBackgroundUploadError(`${stillFailed.length} upload(s) retrying in background...`);
    } else {
      setBackgroundUploadError('');
    }
  }, [retryingUploads, failedUploads, uploadVideo]);

  const handleAutoAdvance = useCallback(async () => {
    if (!recordedBlob || !candidateId || !interview || !candidate) return;

    const currentBlob = recordedBlob;
    const questionIndex = currentQuestionIndex;
    const isLastQuestion = currentQuestionIndex >= interview.questions.length - 1;

    setAutoAdvancing(true);
    setUploading(true);
    setError('');

    if (isLastQuestion) {
      if (failedUploads.length > 0) {
        setError(`Finishing previous uploads (${failedUploads.length} remaining)...`);
        await retryFailedUploads();
        
        if (failedUploads.length > 0) {
          setAutoAdvancing(false);
          setUploading(false);
          setError('Some previous answers failed to upload. Please check your connection and wait for them to finish.');
          return;
        }
      }

      const success = await uploadVideo(currentBlob, questionIndex);

      if (success) {
        router.push(`/interview/${interview_id}/complete?candidate_id=${candidateId}`);
      } else {
        setAutoAdvancing(false);
        setUploading(false);
        setError('Failed to save the final answer. Please check your internet and try again.');
        setFailedUploads(prev => [...prev, { blob: currentBlob, questionIndex, attempts: 1 }]);
      }
    } else {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setRecordedBlob(null);
        setAutoAdvancing(false);
        setUploading(false);
      }, 800);

      uploadVideo(currentBlob, questionIndex).then(success => {
        if (success) {
          setUploadedCount(prev => prev + 1);
        } else {
          setFailedUploads(prev => [...prev, { blob: currentBlob, questionIndex, attempts: 1 }]);
          setBackgroundUploadError(`Question ${currentQuestionIndex + 1} uploading in background...`);
        }
      }).catch(() => {
        setFailedUploads(prev => [...prev, { blob: currentBlob, questionIndex, attempts: 1 }]);
      });
    }
  }, [
    recordedBlob,
    candidateId,
    interview,
    candidate,
    currentQuestionIndex,
    failedUploads,
    retryFailedUploads,
    uploadVideo,
    router,
    interview_id
  ]);

  const handleManualStart = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setIsCountingDown(false);
    setCanRecord(true);
  };

  const handleRecordingComplete = (blob: Blob) => {
    setRecordedBlob(blob);
    setError('');
    setBackgroundUploadError('');
  };

  useEffect(() => {
    if (recordedBlob && !uploading && !autoAdvancing && !advanceRef.current) {
      advanceRef.current = true;
      handleAutoAdvance();
    }
  }, [recordedBlob, uploading, autoAdvancing, handleAutoAdvance]);

  useEffect(() => {
    if (failedUploads.length > 0 && !retryingUploads) {
      retryFailedUploads();
    }
  }, [failedUploads.length, retryingUploads, retryFailedUploads]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!interview || !candidate) return null;

  const currentQuestion = interview.questions[currentQuestionIndex];
  const totalQuestions = interview.questions.length;
  const isLastQuestion = currentQuestionIndex >= interview.questions.length - 1;
  const isTimeRunningLow = remainingGlobalTime !== null && remainingGlobalTime < 120;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center h-16 shrink-0">
        <div>
          <h1 className="text-sm font-bold text-gray-900 uppercase">{interview.job_title}</h1>
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className={`font-mono transition-colors duration-300 ${isTimeRunningLow ? 'text-red-600 font-bold animate-pulse' : 'text-gray-500'}`}>
              ⏱️ Time Remaining: {formatTime(remainingGlobalTime)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase">Question</p>
          <p className="text-xl font-bold text-[#667eea]">
            {currentQuestionIndex + 1} <span className="text-gray-400 text-base">/ {totalQuestions}</span>
          </p>
        </div>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        <div className="lg:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 shrink-0">
            <h2 className="text-xs font-bold text-blue-800 uppercase">Current Question</h2>
          </div>
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <h3 className="text-xl font-medium text-gray-800 leading-relaxed">
              {currentQuestion.replace(/^\d+\.\s*/, '')}
            </h3>
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0">
            <p className="text-xs text-gray-500 flex items-center">
              <span className="mr-2">ℹ️</span> You have 3 minutes to answer.
            </p>
          </div>
        </div>

        <div className="lg:w-2/3 bg-black rounded-xl overflow-hidden shadow-lg relative flex flex-col">
          {isCountingDown && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 backdrop-blur-sm">
              <div className="text-center p-8 max-w-md">
                <h3 className="text-gray-500 text-lg font-medium mb-4">Read & Prepare</h3>
                <div className="text-8xl font-bold text-[#667eea] font-mono mb-6 animate-pulse">
                  {countdownSeconds}
                </div>
                <button onClick={handleManualStart} className="px-8 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors">
                  I'm Ready, Start Now
                </button>
                <p className="text-xs text-gray-400 mt-4">Recording will start automatically when timer ends</p>
              </div>
            </div>
          )}

          {autoAdvancing && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm text-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
                <h3 className="text-2xl font-bold">Saving Answer...</h3>
                <p className="text-gray-400">{isLastQuestion ? 'Finalizing interview' : 'Moving to next question'}</p>
              </div>
            </div>
          )}

          <VideoRecorder 
            videoRef={proctoringVideoRef}
            onRecordingComplete={handleRecordingComplete}
            maxDuration={180}
            autoStartRecording={canRecord}
          />
        </div>
      </main>

      <div className="bg-white border-t border-gray-200 p-3 shrink-0 text-xs text-gray-500 flex justify-between items-center">
        <div>
          {failedUploads.length > 0 ? (
            <span className="text-amber-600 font-bold animate-pulse">⚠️ {failedUploads.length} uploads retrying in background...</span>
          ) : (
            <span className="text-green-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Systems Normal
            </span>
          )}
        </div>
        <div className="opacity-50">
          Candidate ID: {candidateId?.slice(0,8)}
        </div>
      </div>

      <ProctoringNotification
        notification={proctoring.notification}
        onDismiss={proctoring.dismissNotification}
      />
    </div>
  );
}