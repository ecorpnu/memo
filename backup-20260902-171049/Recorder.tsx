import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AspectRatio, Question, QAPair } from '../types';
import { useLiveSession } from '../hooks/useLiveSession';
import { DEFAULT_QUESTIONS, parseQuestionsFile } from '../services/questionService';
import { Download, Upload, Settings2, Camera, Mic, Square, Play, Pause, ChevronRight, X, FileText, Sparkles } from 'lucide-react';

const Recorder: React.FC = () => {
  const apiKey = process.env.API_KEY;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Portrait);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const currentQuestionText = questions[currentQuestionIndex]?.text || "";
  const systemInstruction = `
    You are a gentle, empathetic digital biographer and podcast host. 
    Your goal is to help the user build a digital twin of themselves by recording their memories.
    The user is currently answering this question: "${currentQuestionText}".
    Listen carefully. If the user stops talking for a while, interject with a short, text-based follow-up question. 
    Keep your interjections concise (under 15 words). Be classy and supportive.
  `;

  const { 
    status: liveStatus, 
    connect: connectLive, 
    disconnect: disconnectLive, 
    pause: pauseLive,
    resume: resumeLive,
    hostInterjection,
    currentTranscript,
    resetTranscript
  } = useLiveSession({ apiKey: apiKey, systemInstruction });

  const initCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    const constraintsMap = {
      [AspectRatio.Portrait]: { width: { ideal: 720 }, height: { ideal: 1280 } },
      [AspectRatio.Landscape]: { width: { ideal: 1280 }, height: { ideal: 720 } },
      [AspectRatio.Square]: { width: { ideal: 1080 }, height: { ideal: 1080 } },
      [AspectRatio.ThreeFour]: { width: { ideal: 960 }, height: { ideal: 1280 } },
    };

    const preferredConstraints: MediaStreamConstraints = {
      audio: true,
      video: {
        facingMode: 'user',
        ...constraintsMap[aspectRatio]
      }
    };

    try {
      const newStream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing media devices.", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr) {
        alert("Could not access camera/microphone. Please ensure permissions are granted.");
      }
    }
  }, [aspectRatio]);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastUpdate = 0;

    const updateAudioLevel = (time: number) => {
      if (time - lastUpdate > 50) {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        setAudioLevel(average);
        lastUpdate = time;
      }
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream]);

  useEffect(() => {
    initCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      disconnectLive();
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      const timeoutId = setTimeout(() => initCamera(), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [aspectRatio, isRecording, initCamera]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTranscript]);

  const startRecording = async () => {
    if (!stream) return;
    await connectLive(stream);
    
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 
                     MediaRecorder.isTypeSupported('video/webm;codecs=h264') ? 'video/webm;codecs=h264' :
                     'video/webm';

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.start(1000);
    setIsRecording(true);
    setIsPaused(false);
    setDuration(0);
    resetTranscript();
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
        if (mediaRecorderRef.current.state === 'paused') mediaRecorderRef.current.resume();
        resumeLive();
        setIsPaused(false);
    } else {
        if (mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.pause();
        pauseLive();
        setIsPaused(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
          disconnectLive();
          setIsRecording(false);
          setIsPaused(false);
          const finalPair = saveCurrentQAPair();
          const finalData = finalPair ? [...qaPairs, finalPair] : qaPairs;
          downloadVideo();
          downloadJSON(finalData);
      };
      mediaRecorderRef.current.stop();
    }
  };

  const saveCurrentQAPair = (): QAPair | null => {
    if (currentTranscript && currentTranscript.trim().length > 0) {
        const newPair: QAPair = { Q: questions[currentQuestionIndex].text, A: currentTranscript };
        setQaPairs(prev => [...prev, newPair]);
        resetTranscript();
        return newPair;
    }
    resetTranscript();
    return null;
  };

  const nextQuestion = () => {
    if (isPaused) togglePause();
    saveCurrentQAPair();
    if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
    } else {
        stopRecording();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const parsed = await parseQuestionsFile(e.target.files[0]);
        setQuestions(parsed);
        setCurrentQuestionIndex(0);
      } catch (err) {
        alert("Failed to parse question file.");
      }
    }
  };

  const downloadVideo = () => {
    if (chunksRef.current.length === 0) return;
    const mimeType = mediaRecorderRef.current?.mimeType || 'video/mp4';
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memoria_session_${new Date().toISOString()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = (dataOverride?: QAPair[]) => {
    const data = dataOverride || qaPairs;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memoria_transcript_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case AspectRatio.Portrait: return 'aspect-[9/16]';
      case AspectRatio.Landscape: return 'aspect-[16/9]';
      case AspectRatio.Square: return 'aspect-square';
      case AspectRatio.ThreeFour: return 'aspect-[3/4]';
      default: return 'aspect-[9/16]';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (liveStatus) {
      case 'connected': return 'bg-emerald-500/80 text-white';
      case 'connecting': return 'bg-amber-500/80 text-white animate-pulse';
      case 'error': return 'bg-red-500/80 text-white';
      default: return 'bg-gray-800/60 text-gray-300';
    }
  };

  const getStatusText = () => {
    switch (liveStatus) {
      case 'connected': return 'AI CONNECTED';
      case 'connecting': return 'CONNECTING...';
      case 'error': return 'AI ERROR';
      default: return 'AI READY';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 lg:p-8 font-sans bg-pastel-cream text-pastel-slate">
      <header className="w-full max-w-6xl flex justify-between items-center mb-6 lg:mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pastel-slate text-white rounded-xl flex items-center justify-center shadow-lg shadow-pastel-slate/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
             <h1 className="text-2xl font-serif font-bold tracking-tight text-pastel-charcoal">Memoria</h1>
             <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Digital Twin Recorder</p>
          </div>
        </div>
        <button 
            onClick={() => setShowSettings(!showSettings)}
            className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-full shadow-sm hover:shadow-md hover:border-pastel-slate/30 transition-all"
        >
            <Settings2 className="w-4 h-4 text-gray-500 group-hover:text-pastel-slate transition-colors" />
            <span className="text-sm font-medium text-gray-600 group-hover:text-pastel-slate">Settings</span>
        </button>
      </header>

      {showSettings && (
        <div className="w-full max-w-2xl bg-white p-6 rounded-3xl shadow-xl shadow-pastel-slate/5 border border-gray-100 mb-8 animate-fade-in relative z-20">
           <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h2 className="text-lg font-bold text-pastel-charcoal flex items-center gap-2">
                <Settings2 className="w-5 h-5" /> Configuration
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
           </div>
           <div className="space-y-6">
              <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Aspect Ratio</label>
                  <div className="grid grid-cols-4 gap-3">
                      {Object.values(AspectRatio).map((ratio) => (
                          <button
                            key={ratio}
                            onClick={() => setAspectRatio(ratio)}
                            className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${aspectRatio === ratio ? 'bg-pastel-slate text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                          >
                            {ratio}
                          </button>
                      ))}
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Questions Source</label>
                  <div className="relative">
                      <input type="file" id="q-upload" className="hidden" accept=".json,.txt" onChange={handleFileUpload} />
                      <label htmlFor="q-upload" className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-pastel-slate hover:bg-gray-50 transition-colors group">
                          <Upload className="w-5 h-5 text-gray-400 mr-2 group-hover:text-pastel-slate" />
                          <span className="text-sm text-gray-500 font-medium group-hover:text-pastel-slate">Upload Questions JSON/TXT</span>
                      </label>
                  </div>
              </div>
           </div>
        </div>
      )}

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center">
            <div className={`relative w-full shadow-2xl shadow-pastel-slate/20 rounded-[2rem] overflow-hidden bg-gray-900 border-4 border-white ${getAspectRatioClass()} transition-all duration-500`}>
               <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
               <div className="absolute inset-0 flex flex-col p-6 lg:p-8 pointer-events-none">
                  <div className="flex justify-between items-start">
                     <div className="flex flex-col gap-2">
                         {isRecording && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 ${isPaused ? 'bg-amber-500/80' : 'bg-red-500/80'} text-white shadow-lg transition-all`}>
                                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-200' : 'bg-white animate-pulse'}`} />
                                <span className="text-xs font-bold tracking-wider mr-1">{isPaused ? 'PAUSED' : 'REC'}</span>
                                <span className="text-xs font-mono font-medium border-l border-white/20 pl-2">{formatDuration(duration)}</span>
                            </div>
                         )}
                         {!isRecording && <div className="self-start px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-white/80 text-xs font-bold border border-white/10">PREVIEW</div>}
                     </div>
                     <div className="flex flex-col items-end gap-2">
                         <div className={`px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 text-xs font-bold transition-all duration-300 ${getStatusColor()}`}>
                            {getStatusText()}
                         </div>
                         <div className="h-8 flex items-end gap-0.5 p-1.5 bg-black/20 backdrop-blur-sm rounded-lg border border-white/5">
                             {[...Array(5)].map((_, i) => (
                                 <div 
                                    key={i} 
                                    className="w-1.5 bg-white/90 rounded-full transition-all duration-75"
                                    style={{ 
                                        height: `${Math.max(4, Math.min(20, audioLevel * (0.5 + Math.random())))}px`,
                                        opacity: audioLevel > 5 ? 1 : 0.3 
                                    }} 
                                 />
                             ))}
                         </div>
                     </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-4">
                     {hostInterjection && !isPaused && (
                        <div className="max-w-md bg-white/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl animate-slide-down transform border border-white/50">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-3 h-3 text-pastel-slate" />
                                <span className="text-[10px] font-bold text-pastel-slate uppercase tracking-wider">Interviewer</span>
                            </div>
                            <p className="text-lg font-medium text-gray-800 leading-snug text-center font-serif italic">
                               "{hostInterjection}"
                            </p>
                        </div>
                     )}
                  </div>
                  <div className="bg-gradient-to-t from-black/80 to-transparent -mx-6 -mb-6 lg:-mx-8 lg:-mb-8 p-6 lg:p-8 pt-20">
                     <div className="bg-white/95 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-white/40 animate-slide-down">
                         <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Question {currentQuestionIndex + 1} / {questions.length}</span>
                         </div>
                         <h2 className="text-xl md:text-2xl font-serif text-gray-900 leading-snug">
                            {questions[currentQuestionIndex]?.text}
                         </h2>
                     </div>
                  </div>
               </div>
            </div>
        </div>
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 h-full min-h-[500px]">
           <div className="bg-white p-6 rounded-3xl shadow-xl shadow-pastel-slate/5 border border-gray-100 flex flex-col gap-4">
               {!isRecording ? (
                 <button 
                    onClick={startRecording}
                    disabled={!stream || !apiKey}
                    className="w-full py-5 bg-pastel-slate text-white rounded-2xl font-bold text-lg hover:bg-pastel-charcoal transition-all shadow-lg shadow-pastel-slate/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                 >
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <Camera className="w-4 h-4 fill-current" />
                    </div>
                    Start Recording
                 </button>
               ) : (
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={togglePause}
                            className={`py-4 rounded-2xl font-bold text-base transition-all flex flex-col items-center justify-center gap-2 ${isPaused ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
                            {isPaused ? "Resume" : "Pause"}
                        </button>
                        <button 
                            onClick={stopRecording}
                            className="py-4 bg-red-50 text-red-600 rounded-2xl font-bold text-base hover:bg-red-100 transition-all flex flex-col items-center justify-center gap-2"
                        >
                            <Square className="w-6 h-6 fill-current" />
                            Stop
                        </button>
                    </div>
                    <button 
                      onClick={nextQuestion}
                      className="w-full py-4 bg-pastel-mint text-emerald-800 border border-emerald-100 rounded-2xl font-bold text-lg hover:bg-emerald-100 transition-all shadow-sm flex items-center justify-center gap-2 group"
                    >
                      Next Question 
                      <div className="bg-white/40 p-1 rounded-full group-hover:translate-x-1 transition-transform">
                          <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                 </div>
               )}
               {!apiKey && (
                 <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-xl border border-red-100 flex items-center gap-2">
                   <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                   API Key Missing.
                 </div>
               )}
           </div>
           <div className="flex-1 bg-white rounded-3xl shadow-xl shadow-pastel-slate/5 border border-gray-100 overflow-hidden flex flex-col h-[400px]">
               <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                   <div className="flex items-center gap-2">
                       <FileText className="w-4 h-4 text-pastel-slate" />
                       <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live Transcript</h3>
                   </div>
                   <button onClick={() => downloadJSON()} disabled={qaPairs.length === 0} className="text-gray-400 hover:text-pastel-slate transition-colors disabled:opacity-30">
                       <Download className="w-4 h-4" />
                   </button>
               </div>
               <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
                   {currentTranscript ? (
                       <div className="flex flex-col gap-2">
                          <p className="text-gray-600 leading-relaxed text-sm font-medium animate-fade-in">
                              {currentTranscript}
                          </p>
                          <div ref={transcriptEndRef} />
                       </div>
                   ) : (
                       <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                           <Mic className="w-8 h-8 opacity-20" />
                           <p className="text-xs">Waiting for speech...</p>
                       </div>
                   )}
               </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Recorder;