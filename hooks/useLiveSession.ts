import { useState, useRef, useEffect, useCallback } from 'react';
import Groq from 'groq-sdk';
import { ConnectionStatus } from '../types';

interface UseLiveSessionProps {
  apiKey: string | undefined;
  systemInstruction: string;
}

export const useLiveSession = ({ apiKey, systemInstruction }: UseLiveSessionProps) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [hostInterjection, setHostInterjection] = useState<string>('');
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const groqClientRef = useRef<Groq | null>(null);
  const currentTranscriptRef = useRef<string>(''); 
  const isLivePausedRef = useRef(false);
  const conversationHistoryRef = useRef<Array<{role: string, content: string}>>([]);
  const transcriptionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptLengthRef = useRef(0);

  const connect = useCallback(async (stream: MediaStream) => {
    if (!apiKey) {
      console.error("No API Key provided");
      setStatus('error');
      return;
    }

    setStatus('connecting');
    isLivePausedRef.current = false;
    
    // Initialize Groq client
    groqClientRef.current = new Groq({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Note: In production, use a backend proxy
    });

    try {
      // Set up audio recording for transcription
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !isLivePausedRef.current) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording in 3-second chunks for transcription
      mediaRecorder.start(3000);
      setStatus('connected');
      console.log('Groq Live Session Started');

      // Process audio chunks periodically for transcription
      transcriptionIntervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length > 0 && !isLivePausedRef.current && groqClientRef.current) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];

          try {
            // Convert blob to File for Groq API
            const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
            
            // Transcribe using Groq's Whisper
            const transcription = await groqClientRef.current.audio.transcriptions.create({
              file: audioFile,
              model: 'whisper-large-v3-turbo',
              response_format: 'json',
              language: 'en',
            });

            if (transcription.text && transcription.text.trim()) {
              currentTranscriptRef.current += ' ' + transcription.text;
              setCurrentTranscript(currentTranscriptRef.current);
              
              // Reset silence timeout
              if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
              }

              // Check for silence and trigger AI response
              silenceTimeoutRef.current = setTimeout(async () => {
                if (currentTranscriptRef.current.length > lastTranscriptLengthRef.current) {
                  await generateHostResponse();
                  lastTranscriptLengthRef.current = currentTranscriptRef.current.length;
                }
              }, 5000); // Wait 5 seconds of silence before generating response
            }
          } catch (error) {
            console.error('Transcription error:', error);
          }
        }
      }, 3000);

    } catch (error) {
      console.error("Failed to connect live session", error);
      setStatus('error');
    }
  }, [apiKey, systemInstruction]);

  const generateHostResponse = async () => {
    if (!groqClientRef.current || isLivePausedRef.current) return;

    try {
      // Build conversation context
      const messages = [
        {
          role: 'system',
          content: systemInstruction
        },
        ...conversationHistoryRef.current,
        {
          role: 'user',
          content: currentTranscriptRef.current
        }
      ];

      // Generate response using Groq
      const completion = await groqClientRef.current.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 150,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        setHostInterjection(response);
        
        // Update conversation history
        conversationHistoryRef.current.push(
          { role: 'user', content: currentTranscriptRef.current },
          { role: 'assistant', content: response }
        );

        // Keep conversation history manageable (last 10 exchanges)
        if (conversationHistoryRef.current.length > 20) {
          conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
        }

        // Clear interjection after 8 seconds
        setTimeout(() => setHostInterjection(''), 8000);
      }
    } catch (error) {
      console.error('Error generating host response:', error);
    }
  };

  const disconnect = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
    }
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    audioChunksRef.current = [];
    conversationHistoryRef.current = [];
    setStatus('disconnected');
    setHostInterjection('');
    console.log('Groq Live Session Closed');
  }, []);

  const pause = useCallback(() => {
    isLivePausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    isLivePausedRef.current = false;
  }, []);

  const resetTranscript = useCallback(() => {
    currentTranscriptRef.current = '';
    setCurrentTranscript('');
    conversationHistoryRef.current = [];
    lastTranscriptLengthRef.current = 0;
  }, []);

  return {
    status,
    connect,
    disconnect,
    pause,
    resume,
    hostInterjection,
    currentTranscript,
    resetTranscript
  };
};
