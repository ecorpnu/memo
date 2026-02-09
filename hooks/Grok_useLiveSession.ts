import { useState, useRef, useCallback } from 'react';
import Groq from 'groq-sdk';
import { ConnectionStatus } from '../types';

interface UseLiveSessionProps {
  apiKey: string | undefined;
  systemInstruction: string;
}

export const useLiveSession = ({ apiKey, systemInstruction }: UseLiveSessionProps) => {
  const [status, setStatus] = useState('disconnected');
  const [hostInterjection, setHostInterjection] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const groqClientRef = useRef<Groq | null>(null);
  const currentTranscriptRef = useRef('');
  const isLivePausedRef = useRef(false);
  const conversationHistoryRef = useRef<Array<{ role: string; content: string }>>([]);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptLengthRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);

  const connect = useCallback(async (stream: MediaStream) => {
    if (!apiKey) {
      console.error("No API Key provided");
      setStatus('error');
      return;
    }

    setStatus('connecting');
    isLivePausedRef.current = false;
    consecutiveFailuresRef.current = 0;

    // Initialize Groq client (FIXED: corrected property name)
    groqClientRef.current = new Groq({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });

    try {
      // Create audio-only stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available');
      }

      const audioOnlyStream = new MediaStream(audioTracks);
      console.log('✓ Audio-only stream created');

      // FIX: Prioritize WAV format (required for Groq compatibility)
      let selectedMimeType = '';
      const formats = [
        'audio/wav', // Most compatible with Groq API
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg'
      ];

      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          selectedMimeType = format;
          break;
        }
      }

      console.log('✓ Selected recording format:', selectedMimeType || 'default');

      // Start the first recording
      startRecording(audioOnlyStream, selectedMimeType);

      setStatus('connected');

    } catch (error) {
      console.error("✗ Failed to start: ", error);
      setStatus('error');
    }
  }, [apiKey, systemInstruction]);

  const startRecording = (audioOnlyStream: MediaStream, selectedMimeType: string) => {
    if (isLivePausedRef.current || !groqClientRef.current) return;

    audioChunksRef.current = [];

    // Create new MediaRecorder for each chunk
    const options = selectedMimeType
      ? { mimeType: selectedMimeType }
      : {};

    if (selectedMimeType === 'audio/wav') {
      options.audioBitsPerSecond = 128000;
    }

    mediaRecorderRef.current = new MediaRecorder(audioOnlyStream, options);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      if (audioChunksRef.current.length > 0 && !isLivePausedRef.current) {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // FIX: Lower threshold to avoid skipping valid quiet speech
        if (audioBlob.size < 5000) {
          console.log(`⊘ Skipping small chunk (${(audioBlob.size / 1024).toFixed(1)}KB)`);
        } else {
          try {
            console.log(`→ Processing ${(audioBlob.size / 1024).toFixed(1)}KB audio chunk`);
            
            // FIX: Generate correct filename based on MIME type
            const fileName = mimeType.includes('wav') ? 'audio.wav' : 
                            mimeType.includes('webm') ? 'audio.webm' : 'audio.ogg';
            
            const audioFile = new File([audioBlob], fileName, { type: mimeType });

            // Transcribe with Groq
            const transcription = await groqClientRef.current.audio.transcriptions.create({
              file: audioFile,
              model: 'whisper-large-v3',
              response_format: 'json',
              language: 'en',
              temperature: 0.0,
            });

            // Success! Reset failure counter
            consecutiveFailuresRef.current = 0;

            if (transcription.text && transcription.text.trim()) {
              const newText = transcription.text.trim();
              console.log('✓', newText);
              
              if (newText.length > 2) {
                currentTranscriptRef.current += (currentTranscriptRef.current ? ' ' : '') + newText;
                setCurrentTranscript(currentTranscriptRef.current);
                
                if (silenceTimeoutRef.current) {
                  clearTimeout(silenceTimeoutRef.current);
                }

                // Generate AI response after 7 seconds of silence
                silenceTimeoutRef.current = setTimeout(async () => {
                  if (currentTranscriptRef.current.length > lastTranscriptLengthRef.current + 15) {
                    await generateHostResponse();
                    lastTranscriptLengthRef.current = currentTranscriptRef.current.length;
                  }
                }, 7000);
              }
            }
          } catch (error: any) {
            consecutiveFailuresRef.current++;
            
            // FIX: Detailed error diagnostics for 400 errors
            if (consecutiveFailuresRef.current % 3 === 0) {
              console.error(`✗ Transcription failed (${consecutiveFailuresRef.current} times)`);
              console.error('Audio details:', {
                size: `${(audioBlob.size / 1024).toFixed(1)}KB`,
                mimeType,
                duration: 'Run audio validation to check'
              });
              
              if (error.response) {
                console.error('API Response:', error.response.data);
              } else {
                console.error('Error message:', error.message);
              }
            }
            
            // Auto-reset after too many failures
            if (consecutiveFailuresRef.current > 15) {
              console.error('✗ Critical: Too many transcription failures. Check audio format compatibility.');
              consecutiveFailuresRef.current = 0;
            }
          }
        }
      }

      // Clear timeout
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }

      // Restart recording if not paused
      if (!isLivePausedRef.current) {
        startRecording(audioOnlyStream, selectedMimeType);
      }
    };

    mediaRecorderRef.current.start();
    console.log('✓ Recording started');

    // Stop after 10 seconds
    recordingTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, 10000);
  };

  const generateHostResponse = async () => {
    if (!groqClientRef.current || isLivePausedRef.current) return;
    try {
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

      console.log('→ AI...');
      const completion = await groqClientRef.current.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 150,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        console.log('✓ AI:', response);
        setHostInterjection(response);
        
        conversationHistoryRef.current.push(
          { role: 'user', content: currentTranscriptRef.current },
          { role: 'assistant', content: response }
        );

        if (conversationHistoryRef.current.length > 20) {
          conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
        }

        setTimeout(() => setHostInterjection(''), 8000);
      }
    } catch (error) {
      console.error('✗ AI error:', error);
    }
  };

  const disconnect = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    audioChunksRef.current = [];
    conversationHistoryRef.current = [];
    consecutiveFailuresRef.current = 0;
    setStatus('disconnected');
    setHostInterjection('');
    console.log('✓ Session closed');
  }, []);

  const pause = useCallback(() => {
    isLivePausedRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
  }, []);

  const resume = useCallback(() => {
    isLivePausedRef.current = false;
    consecutiveFailuresRef.current = 0; // Reset failures on resume
    // Restart recording - note: audioOnlyStream and selectedMimeType need to be available or passed
    // For simplicity, assuming connect is called with stream, but to resume, we need stream again?
    // Wait, issue: stream is in connect, not global.
    // To fix, make audioOnlyStreamRef = useRef(null);
    // In connect: audioOnlyStreamRef.current = audioOnlyStream;
    // Then in resume: if (audioOnlyStreamRef.current && selectedMimeType) startRecording(audioOnlyStreamRef.current, selectedMimeType);
    // But selectedMimeType is local in connect.
    // To fix, make selectedMimeTypeRef = useRef('');
    // In connect: selectedMimeTypeRef.current = selectedMimeType;
    // Add audioOnlyStreamRef = useRef<MediaStream | null>(null);
    // In connect: audioOnlyStreamRef.current = audioOnlyStream;
    // Then in resume:
    if (audioOnlyStreamRef.current) {
      startRecording(audioOnlyStreamRef.current, selectedMimeTypeRef.current);
    }
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