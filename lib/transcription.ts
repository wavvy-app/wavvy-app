import Groq from 'groq-sdk';
import { downloadVideoAsAudio } from './utils/video';
import { File } from 'node:buffer'; 

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      const isRetryable = 
        lastError.message?.includes('Connection error') ||
        lastError.message?.includes('ECONNRESET') ||
        lastError.message?.includes('ETIMEDOUT') ||
        lastError.message?.includes('timeout') ||
        lastError.message?.includes('fetch failed') ||
        (error as any).status === 429 ||
        (error as any).status === 500 ||
        (error as any).status === 502 ||
        (error as any).status === 503 ||
        (error as any).status === 504;
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 500;
      const totalDelay = delay + jitter;
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  throw lastError;
}

export async function transcribeVideo(videoUrl: string): Promise<string> {
  return retryWithBackoff(
    async () => {
      const audioBuffer = await downloadVideoAsAudio(videoUrl);
      
      const audioFile = new File([audioBuffer], 'audio.webm', {
        type: 'audio/webm',
      });
      
      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'json',
        temperature: 0.0,
      });
      
      return transcription.text.trim();
    },
    3,
    2000,
    `Transcription for ${videoUrl.split('/').pop()}`
  );
}

export async function transcribeMultipleVideos(
  videoUrls: string[]
): Promise<string[]> {
  const transcripts: string[] = [];
  
  for (let i = 0; i < videoUrls.length; i++) {
    try {
      const transcript = await transcribeVideo(videoUrls[i]);
      transcripts.push(transcript);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      transcripts.push(`[Transcription failed: ${message}]`);
    }
    
    if (i < videoUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return transcripts;
}