import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { arrayBufferToBase64, downsampleBuffer, float32To16BitPCM } from '../utils/audio-utils';
import { ConnectionStatus } from '../types';

interface UseLiveSessionProps {
  apiKey: string | undefined;
  systemInstruction: string;
}

export const useLiveSession = ({ apiKey, systemInstruction }: UseLiveSessionProps) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [hostInterjection, setHostInterjection] = useState<string>('');
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  
  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentTranscriptRef = useRef<string>(''); // Mutable ref to hold transcript between renders
  
  // Ref for pausing data transmission without closing session
  const isLivePausedRef = useRef(false);

  const connect = useCallback(async (stream: MediaStream) => {
    if (!apiKey) {
      console.error("No API Key provided");
      return;
    }

    setStatus('connecting');
    mediaStreamRef.current = stream;
    isLivePausedRef.current = false; // Reset pause state on new connection

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Initialize Audio Context for input processing
      // Note: Browser might ignore sampleRate request and use hardware rate (e.g. 48000)
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = ac;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], // Required by API
          systemInstruction: systemInstruction,
          inputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
          outputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            console.log('Gemini Live Session Opened');

            // Setup Audio Processing Pipeline
            const source = ac.createMediaStreamSource(stream);
            // 4096 buffer size, 1 input channel, 1 output channel
            const processor = ac.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
              // Check if paused before sending data
              if (isLivePausedRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              
              // Ensure we are sending 16kHz audio
              let pcmData;
              if (ac.sampleRate !== 16000) {
                 const resampled = downsampleBuffer(inputData, ac.sampleRate, 16000);
                 pcmData = float32To16BitPCM(resampled);
              } else {
                 pcmData = float32To16BitPCM(inputData);
              }
              
              const base64Data = arrayBufferToBase64(pcmData);

              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data
                  }
                });
              });
            };

            source.connect(processor);
            processor.connect(ac.destination); // Required for script processor to run

            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: (msg: LiveServerMessage) => {
            // Handle Model Output Transcription (The "Interjection")
            if (msg.serverContent?.outputTranscription) {
               const text = msg.serverContent.outputTranscription.text;
               if (text) {
                 setHostInterjection(prev => {
                    const newVal = prev + text;
                    return newVal;
                 });
                 setTimeout(() => setHostInterjection(''), 8000); 
               }
            }

            // Handle User Input Transcription (For the JSON record)
            if (msg.serverContent?.inputTranscription) {
                const text = msg.serverContent.inputTranscription.text;
                if (text) {
                  currentTranscriptRef.current += text;
                  setCurrentTranscript(currentTranscriptRef.current);
                }
            }
          },
          onclose: () => {
            setStatus('disconnected');
            console.log('Gemini Live Session Closed');
          },
          onerror: (err) => {
            console.error('Gemini Live Error', err);
            setStatus('error');
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error("Failed to connect live session", error);
      setStatus('error');
    }
  }, [apiKey, systemInstruction]);

  const disconnect = useCallback(() => {
    if (processorRef.current && sourceRef.current) {
        processorRef.current.disconnect();
        sourceRef.current.disconnect();
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
    }
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
    }
    setStatus('disconnected');
    setHostInterjection('');
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