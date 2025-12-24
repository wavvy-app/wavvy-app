'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
  autoStartRecording?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export interface VideoRecorderHandle {
  resetForNextQuestion: () => void;
  startRecordingNow: () => void;
}

const VideoRecorder = forwardRef<VideoRecorderHandle, VideoRecorderProps>(({
  onRecordingComplete,
  maxDuration = 180,
  autoStartRecording = false,
  videoRef: externalVideoRef
}, ref) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  const [showFinishButton, setShowFinishButton] = useState(false);
  const [showRecordedConfirmation, setShowRecordedConfirmation] = useState(false);

  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const FINISH_BUTTON_DELAY = 6;
  const MIN_VALID_BLOB_SIZE = 1000;
  const TIMESLICE_MS = 200;

  const startRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      return;
    }

    const activeStream = streamRef.current;
    if (!activeStream) return;

    const supportedTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    
    const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

    if (!mimeType) {
      setError('Browser recording not supported.');
      return;
    }

    chunksRef.current = [];
    
    const mediaRecorder = new MediaRecorder(activeStream, { 
      mimeType,
      videoBitsPerSecond: 2500000
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (chunksRef.current.length === 0) {
        setError("Recording failed: No data captured.");
        return;
      }

      const blob = new Blob(chunksRef.current, { type: mimeType });
      
      if (blob.size < MIN_VALID_BLOB_SIZE) {
        setError("Recording error: Video file too small.");
        return;
      }

      setRecordedBlob(blob);

      setShowRecordedConfirmation(true);
      setTimeout(() => {
        setShowRecordedConfirmation(false);
        onRecordingComplete(blob);
      }, 1000);
    };

    mediaRecorder.start(TIMESLICE_MS);
    mediaRecorderRef.current = mediaRecorder;

    setIsRecording(true);
    setRecordingTime(0);
    setError('');

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= maxDuration) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  useImperativeHandle(ref, () => ({
    resetForNextQuestion: () => {
      setIsRecording(false);
      setRecordedBlob(null);
      setRecordingTime(0);
      setShowFinishButton(false);
      setShowRecordedConfirmation(false);
      chunksRef.current = [];
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
    },
    startRecordingNow: () => {
      startRecording();
    },
  }));

  useEffect(() => {
    let isMounted = true;

    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 }, 
            facingMode: 'user' 
          },
          audio: true
        });

        if (!isMounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        setError('');
      } catch (err: any) {
        if (!isMounted) return;

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera/microphone access denied. Please click the lock icon in your browser address bar to allow access.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found. Please connect a device.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is in use by another app (like Zoom/Teams) or blocked by macOS System Settings. Please close other apps and check System Settings > Privacy.');
        } else {
          setError(`System Error: ${err.message || 'Failed to access camera/microphone'}`);
        }
      }
    }

    setupCamera();

    return () => {
      isMounted = false;

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      mediaRecorderRef.current = null;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      const timer = setTimeout(() => setShowFinishButton(true), FINISH_BUTTON_DELAY * 1000);
      return () => clearTimeout(timer);
    } else {
      setShowFinishButton(false);
    }
  }, [isRecording]);

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl group min-h-[400px]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]"
      />

      {error && (
        <ErrorOverlay error={error} />
      )}

      {showRecordedConfirmation && (
        <RecordedConfirmation />
      )}

      {isRecording && (
        <RecordingIndicators recordingTime={recordingTime} formatTime={formatTime} />
      )}

      {isRecording && showFinishButton && (
        <FinishButton onClick={stopRecording} />
      )}
    </div>
  );
});

function ErrorOverlay({ error }: { error: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-50 p-4">
      <div className="text-white text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold mb-2">Camera Issue</h3>
        <p className="text-gray-300 mb-6 text-sm leading-relaxed">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

function RecordedConfirmation() {
  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-40 text-white">
      <div className="bg-green-500 rounded-full p-4 mb-4">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-2xl font-bold">Answer Recorded</h3>
    </div>
  );
}

interface RecordingIndicatorsProps {
  recordingTime: number;
  formatTime: (seconds: number) => string;
}

function RecordingIndicators({ recordingTime, formatTime }: RecordingIndicatorsProps) {
  return (
    <>
      <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-full animate-pulse z-10">
        <div className="w-3 h-3 bg-white rounded-full"></div>
        <span className="font-bold text-xs">REC</span>
      </div>
      <div className="absolute top-4 right-4 bg-black/60 text-white px-4 py-2 rounded-full font-mono text-lg z-10">
        {formatTime(recordingTime)}
      </div>
    </>
  );
}

function FinishButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 flex items-center gap-2 bg-gray-800/90 hover:bg-gray-900 backdrop-blur-sm border border-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all hover:scale-105 z-50"
    >
      <div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div>
      Finish Answer
    </button>
  );
}

VideoRecorder.displayName = 'VideoRecorder';

export default VideoRecorder;