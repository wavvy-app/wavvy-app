'use client';

import { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoRecorder, { VideoRecorderHandle } from '@/components/VideoRecorder';

export default function PracticePage({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const unwrappedParams = use(params);
  const interview_id = unwrappedParams.interview_id;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <PracticeContent interview_id={interview_id} />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🧪</div>
        <p className="text-gray-600">Loading Practice Mode...</p>
      </div>
    </div>
  );
}

function PracticeContent({ interview_id }: { interview_id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const candidateId = searchParams.get('candidate_id');

  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [canRecord, setCanRecord] = useState(false);
  
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRecorderRef = useRef<VideoRecorderHandle>(null);

  useEffect(() => {
    if (!candidateId) {
      router.push(`/interview/${interview_id}/register`);
    }
  }, [candidateId, interview_id, router]);

  const startCountdown = () => {
    setCountdownSeconds(10);
    setIsCountingDown(true);
    setCanRecord(false);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          setIsCountingDown(false);
          setCanRecord(true);
          
          setTimeout(() => {
            videoRecorderRef.current?.startRecordingNow();
          }, 100);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCountdown();
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      videoRecorderRef.current?.resetForNextQuestion();
    };
  }, [recorderKey]);

  const handleManualStart = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setIsCountingDown(false);
    setCanRecord(true);
    
    setTimeout(() => {
      videoRecorderRef.current?.startRecordingNow();
    }, 100);
  };

  const handleRecordingComplete = (blob: Blob) => {
    setRecordedBlob(blob);
    const url = URL.createObjectURL(blob);
    setVideoUrl(url);
  };

  const handleRetry = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setRecordedBlob(null);
    setVideoUrl(null);
    setRecorderKey(prev => prev + 1);
  };

  const handleStartRealInterview = () => {
    const confirmed = window.confirm(
      "You are about to enter the real interview. Recordings cannot be stopped or retried once started. Are you ready?"
    );
    
    if (confirmed) {
      router.push(`/interview/${interview_id}/record?candidate_id=${candidateId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
      <Header />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        <QuestionPanel />
        <VideoPanel
          isCountingDown={isCountingDown}
          countdownSeconds={countdownSeconds}
          recordedBlob={recordedBlob}
          videoUrl={videoUrl}
          recorderKey={recorderKey}
          videoRecorderRef={videoRecorderRef}
          onManualStart={handleManualStart}
          onRecordingComplete={handleRecordingComplete}
          onRetry={handleRetry}
          onStartRealInterview={handleStartRealInterview}
        />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 flex justify-between items-center h-16 shrink-0">
      <div>
        <h1 className="text-sm font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
          <span className="text-xl">🧪</span> Practice Mode
        </h1>
        <p className="text-xs text-emerald-600">This simulates the exact interview experience.</p>
      </div>
      <div className="text-right">
        <span className="px-3 py-1 bg-white border border-emerald-200 rounded-full text-xs font-medium text-emerald-700">
          Safety Check
        </span>
      </div>
    </header>
  );
}

function QuestionPanel() {
  return (
    <div className="lg:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">Practice Question</h2>
      </div>
      <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
        <h3 className="text-xl font-medium text-gray-800 leading-relaxed">
          "Please state your name, your location, and tell us a fun fact about yourself."
        </h3>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800 space-y-2">
          <p className="font-bold">How it works:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>You have a <strong>countdown</strong> to read the question.</li>
            <li>Recording <strong>starts automatically</strong> when the timer hits zero.</li>
            <li>This practice question is the only time you can re-record.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface VideoPanelProps {
  isCountingDown: boolean;
  countdownSeconds: number;
  recordedBlob: Blob | null;
  videoUrl: string | null;
  recorderKey: number;
  videoRecorderRef: React.RefObject<VideoRecorderHandle | null>;
  onManualStart: () => void;
  onRecordingComplete: (blob: Blob) => void;
  onRetry: () => void;
  onStartRealInterview: () => void;
}

function VideoPanel({
  isCountingDown,
  countdownSeconds,
  recordedBlob,
  videoUrl,
  recorderKey,
  videoRecorderRef,
  onManualStart,
  onRecordingComplete,
  onRetry,
  onStartRealInterview,
}: VideoPanelProps) {
  return (
    <div className="lg:w-2/3 bg-black rounded-xl overflow-hidden shadow-lg relative flex flex-col justify-center">
      {!recordedBlob ? (
        <>
          {isCountingDown && (
            <CountdownOverlay 
              countdownSeconds={countdownSeconds}
              onManualStart={onManualStart}
            />
          )}
          <VideoRecorder 
            key={recorderKey}
            ref={videoRecorderRef}
            onRecordingComplete={onRecordingComplete}
            maxDuration={60}
          />
        </>
      ) : (
        <ReviewPanel
          videoUrl={videoUrl}
          onRetry={onRetry}
          onStartRealInterview={onStartRealInterview}
        />
      )}
    </div>
  );
}

interface CountdownOverlayProps {
  countdownSeconds: number;
  onManualStart: () => void;
}

function CountdownOverlay({ countdownSeconds, onManualStart }: CountdownOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="text-center p-8 max-w-md">
        <h3 className="text-gray-500 text-lg font-medium mb-4">Practice: Read & Prepare</h3>
        <div className="text-8xl font-bold text-emerald-600 font-mono mb-6 animate-pulse">
          {countdownSeconds}
        </div>
        <button 
          onClick={onManualStart} 
          className="px-8 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
        >
          I'm Ready, Start Now
        </button>
      </div>
    </div>
  );
}

interface ReviewPanelProps {
  videoUrl: string | null;
  onRetry: () => void;
  onStartRealInterview: () => void;
}

function ReviewPanel({ videoUrl, onRetry, onStartRealInterview }: ReviewPanelProps) {
  return (
    <div className="relative w-full h-full bg-gray-900 flex flex-col items-center justify-center p-4">
      <h3 className="text-white mb-4 font-medium">Review your Practice Answer</h3>
      
      {videoUrl && (
        <video 
          src={videoUrl} 
          controls 
          autoPlay 
          className="w-full max-h-[60vh] rounded-lg shadow-2xl bg-black"
        />
      )}

      <div className="mt-8 flex gap-4">
        <button 
          onClick={onRetry}
          className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <span>↺</span> Try Again
        </button>
        
        <button 
          onClick={onStartRealInterview}
          className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-lg font-bold rounded-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          I'm Ready for the Real Thing →
        </button>
      </div>
    </div>
  );
}