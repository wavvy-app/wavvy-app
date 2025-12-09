'use client';

import { useState, useRef, useEffect } from 'react';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
  autoStartRecording?: boolean;
  // ✅ NEW: Accept a forwarded ref for the video element
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export default function VideoRecorder({ 
  onRecordingComplete, 
  maxDuration = 180,
  autoStartRecording = false,
  videoRef: externalVideoRef  // ✅ NEW: Rename to avoid confusion
}: VideoRecorderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  const [showFinishButton, setShowFinishButton] = useState(false);
  const [showRecordedConfirmation, setShowRecordedConfirmation] = useState(false);

  // ✅ CHANGED: Create internal ref, but use external if provided
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;  // ✅ Use forwarded ref if available
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const FINISH_BUTTON_DELAY = 6;

  // Setup camera (NO CHANGES to this logic - just uses the potentially forwarded ref)
  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true
        });
        setStream(mediaStream);
        
        // ✅ WORKS WITH BOTH: internal or external ref
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        setError('');
      } catch (err: any) {
        console.error("Camera Setup Error:", err.name, err.message);

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
      if (stream) stream.getTracks().forEach(track => track.stop()); 
    };
  }, []); // ✅ No dependency on videoRef - it's stable

  // Auto-start logic (NO CHANGES)
  useEffect(() => {
    if (autoStartRecording && stream && !isRecording && !recordedBlob) {
      startRecording();
    }
  }, [autoStartRecording, stream]);

  // Finish button delay logic (NO CHANGES)
  useEffect(() => {
    if (isRecording) {
      const timer = setTimeout(() => setShowFinishButton(true), FINISH_BUTTON_DELAY * 1000);
      return () => clearTimeout(timer);
    } else {
      setShowFinishButton(false);
    }
  }, [isRecording]);

  const startRecording = () => {
    if (!stream) return;

    // Safari/iPhone MIME type detection (NO CHANGES)
    const mimeTypes = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

    if (!mimeType) {
        setError('Browser recording not supported.');
        return;
    }

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      
      // Show "Answer Recorded" confirmation for 1 second
      setShowRecordedConfirmation(true);
      setTimeout(() => {
        setShowRecordedConfirmation(false);
        onRecordingComplete(blob);
      }, 1000);
    };

    mediaRecorder.start(1000);
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl group min-h-[400px]">
      {/* ✅ CHANGED: Now uses the potentially forwarded ref */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover transform scale-x-[-1]" 
      />

      {/* ERROR OVERLAY (NO CHANGES) */}
      {error && (
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
      )}

      {/* "ANSWER RECORDED" CONFIRMATION (NO CHANGES) */}
      {showRecordedConfirmation && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-40 text-white">
          <div className="bg-green-500 rounded-full p-4 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold">Answer Recorded</h3>
        </div>
      )}

      {/* Recording UI (NO CHANGES) */}
      {isRecording && (
        <>
          <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-full animate-pulse z-10">
             <div className="w-3 h-3 bg-white rounded-full"></div>
             <span className="font-bold text-xs">REC</span>
          </div>
          <div className="absolute top-4 right-4 bg-black/60 text-white px-4 py-2 rounded-full font-mono text-lg z-10">
             {formatTime(recordingTime)}
          </div>
        </>
      )}

      {/* FINISH BUTTON (NO CHANGES) */}
      {isRecording && showFinishButton && (
         <button 
           onClick={stopRecording} 
           className="absolute bottom-4 right-4 flex items-center gap-2 bg-gray-800/90 hover:bg-gray-900 backdrop-blur-sm border border-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all hover:scale-105 z-50"
         >
           <div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div>
           Finish Answer
         </button>
      )}
    </div>
  );
}