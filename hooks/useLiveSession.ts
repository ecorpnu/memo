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
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentTranscriptRef = useRef<string>(''); 
  const isLivePausedRef = useRef(false);

  const connect = useCallback(async (stream: MediaStream) => {
    if (!apiKey) {
      console.error("No API Key provided");
      setStatus('error');
      return;
    }

    setStatus('connecting');
    mediaStreamRef.current = stream;
    isLivePausedRef.current = false;

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = ac;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          // Use empty objects as per GenAI SDK requirements for audio transcription
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            console.log('Gemini Live Session Opened');

            const source = ac.createMediaStreamSource(stream);
            const processor = ac.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
              if (isLivePausedRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
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
            processor.connect(ac.destination);

            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription) {
               const text = msg.serverContent.outputTranscription.text;
               if (text) {
                 setHostInterjection(prev => prev + text);
                 // Interjections fade out after a period
                 setTimeout(() => setHostInterjection(''), 8000); 
               }
            }

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