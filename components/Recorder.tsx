import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AspectRatio, Question, QAPair } from '../types';
import { useLiveSession } from '../hooks/useLiveSession';
import { DEFAULT_QUESTIONS, parseQuestionsFile } from '../services/questionService';
import { Download, Upload, Settings, Camera, Mic, Square, Play, Pause, RefreshCw, ChevronRight, X } from 'lucide-react';

const Recorder: React.FC = () => {
  // Access environment variable dynamically to ensure we catch any runtime injection (e.g. from window.aistudio)
  const apiKey = process.env.API_KEY;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Portrait);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // System instruction for Gemini
  const currentQuestionText = questions[currentQuestionIndex]?.text || "";
  const systemInstruction = `
    You are a gentle, empathetic digital biographer and podcast host. 
    Your goal is to help the user build a digital twin of themselves by recording their memories.
    
    The user is currently answering this question: "${currentQuestionText}".
    
    Listen carefully. If the user stops talking for a while, gets stuck, or gives a very short answer, 
    gently interject with a short, text-based follow-up question to encourage them. 
    
    Do NOT ask a new main question. Just dig deeper into the current topic.
    Keep your interjections concise (under 15 words) as they will be displayed as overlay text.
    Do not be pushy. Be classy and supportive.
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

  // Initialize Camera with fallback strategy
  const initCamera = useCallback(async () => {
    // Stop existing tracks
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
        facingMode: 'user', // Try front camera first
        ...constraintsMap[aspectRatio]
      }
    };

    const standardConstraints: MediaStreamConstraints = {
        audio: true,
        video: {
             ...constraintsMap[aspectRatio] // Try resolution without facing mode
        }
    };
    
    const fallbackConstraints: MediaStreamConstraints = {
        audio: true,
        video: true // Just get any camera
    };

    try {
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch (e1) {
        console.warn("Preferred constraints failed, trying standard...", e1);
        try {
             newStream = await navigator.mediaDevices.getUserMedia(standardConstraints);
        } catch (e2) {
            console.warn("Standard constraints failed, trying fallback...", e2);
            newStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        }
      }
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing media devices.", err);
      alert("Could not access camera/microphone. Please ensure permissions are granted.");
    }
  }, [aspectRatio]); // Don't include stream in dependency to avoid loop, though we handle it inside

  // Initial load
  useEffect(() => {
    initCamera();
    return () => {
      // Cleanup on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      disconnectLive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-init camera when ratio changes (only if not recording)
  useEffect(() => {
    // We need to check if the stream is actually active and matches expectations, 
    // but for simplicity we just re-init if not recording.
    if (!isRecording) {
      // We use a timeout to avoid rapid switching if user clicks fast
      const timeoutId = setTimeout(() => {
          initCamera();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [aspectRatio, isRecording, initCamera]);


  const startRecording = async () => {
    if (!stream) return;
    
    // 1. Connect Gemini Live
    await connectLive(stream);

    // 2. Start MediaRecorder
    // Check supported mime types
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 
                     MediaRecorder.isTypeSupported('video/webm;codecs=h264') ? 'video/webm;codecs=h264' :
                     'video/webm';

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.start(1000); // chunk every second
    setIsRecording(true);
    setIsPaused(false);
    resetTranscript();
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
        // Resume
        if (mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
        }
        resumeLive();
        setIsPaused(false);
    } else {
        // Pause
        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
        }
        pauseLive();
        setIsPaused(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Setup listener for the final stop event to ensure all chunks are collected
      mediaRecorderRef.current.onstop = () => {
          disconnectLive();
          setIsRecording(false);
          setIsPaused(false);
          
          // Save the final chunk of Q&A
          const finalPair = saveCurrentQAPair();
          
          // Construct the complete list for download including the one just saved
          const finalData = finalPair ? [...qaPairs, finalPair] : qaPairs;

          // Prompt download
          downloadVideo();
          downloadJSON(finalData);
      };

      mediaRecorderRef.current.stop();
    }
  };

  const saveCurrentQAPair = (): QAPair | null => {
    // Only save if there is content
    if (currentTranscript && currentTranscript.trim().length > 0) {
        const newPair: QAPair = {
            Q: questions[currentQuestionIndex].text,
            A: currentTranscript
        };
        setQaPairs(prev => [...prev, newPair]);
        resetTranscript();
        return newPair;
    }
    resetTranscript();
    return null;
  };

  const nextQuestion = () => {
    // If we are paused, resume so we can capture the next question
    if (isPaused) {
        togglePause();
    }
    
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
        const parsedQuestions = await parseQuestionsFile(e.target.files[0]);
        setQuestions(parsedQuestions);
        setCurrentQuestionIndex(0);
        alert(`Loaded ${parsedQuestions.length} questions.`);
      } catch (err) {
        alert("Failed to parse question file.");
      }
    }
  };

  const downloadVideo = () => {
    if (chunksRef.current.length === 0) return;
    
    // Determine extension based on recorded mimeType
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
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memoria_transcript_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to get container aspect ratio class
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case AspectRatio.Portrait: return 'aspect-[9/16]';
      case AspectRatio.Landscape: return 'aspect-[16/9]';
      case AspectRatio.Square: return 'aspect-square';
      case AspectRatio.ThreeFour: return 'aspect-[3/4]';
      default: return 'aspect-[9/16]';
    }
  };

  return (
    <div className="min-h-screen bg-pastel-cream p-4 md:p-8 flex flex-col items-center font-sans">
      
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-serif text-pastel-slate font-bold">Memoria</h1>
           <p className="text-sm text-gray-500">Voice of your digital serf</p>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full hover:bg-pastel-lavender transition-colors"
            >
                <Settings className="w-6 h-6 text-pastel-slate" />
            </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="w-full max-w-4xl bg-white p-6 rounded-3xl shadow-lg mb-6 animate-fade-in">
           <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-pastel-slate">Session Settings</h2>
              <button onClick={() => setShowSettings(false)}><X className="w-5 h-5" /></button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Video Dimension</label>
                  <div className="flex gap-2 flex-wrap">
                      {Object.values(AspectRatio).map((ratio) => (
                          <button
                            key={ratio}
                            onClick={() => setAspectRatio(ratio)}
                            className={`px-4 py-2 rounded-xl border ${aspectRatio === ratio ? 'bg-pastel-slate text-white' : 'bg-gray-50 border-gray-200'}`}
                          >
                            {ratio}
                          </button>
                      ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Note: Actual video file dimension depends on camera capabilities.</p>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Questions (JSON/TXT)</label>
                  <label className="flex items-center justify-center w-full h-12 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-xl appearance-none cursor-pointer hover:border-pastel-slate focus:outline-none">
                      <span className="flex items-center space-x-2">
                          <Upload className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-gray-600">Click to upload</span>
                      </span>
                      <input type="file" name="file_upload" className="hidden" accept=".json,.txt" onChange={handleFileUpload} />
                  </label>
              </div>
           </div>
        </div>
      )}

      {/* Main Recording Area */}
      <div className="relative w-full max-w-6xl flex flex-col md:flex-row gap-6 items-start justify-center">
        
        {/* Video Viewport */}
        <div className={`relative w-full md:w-auto mx-auto shadow-2xl rounded-3xl overflow-hidden bg-black transition-all duration-300 ${getAspectRatioClass()} max-h-[80vh]`}>
           <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
           />
           
           {/* Overlay Interface */}
           <div className="absolute inset-0 flex flex-col justify-between p-6 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none">
              
              {/* Top: Current Question */}
              <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 animate-slide-down pointer-events-auto">
                 <div className="text-xs font-bold text-pastel-slate uppercase tracking-wider mb-2">
                    Question {currentQuestionIndex + 1} of {questions.length}
                 </div>
                 <h2 className="text-xl md:text-2xl font-serif text-gray-800 leading-snug">
                    {questions[currentQuestionIndex]?.text}
                 </h2>
              </div>

              {/* Middle: AI Interjections (Host Overlay) */}
              <div className="flex-1 flex items-center justify-center">
                 {hostInterjection && !isPaused && (
                    <div className="bg-pastel-pink/90 backdrop-blur-md px-6 py-4 rounded-xl shadow-lg transform transition-all duration-500 animate-bounce-gentle border border-white/40 max-w-[80%]">
                        <p className="text-lg font-medium text-gray-900 italic text-center">
                           "{hostInterjection}"
                        </p>
                    </div>
                 )}
                 {isPaused && (
                    <div className="bg-black/50 backdrop-blur-md px-8 py-6 rounded-2xl shadow-2xl border border-white/20 animate-pulse">
                        <Pause className="w-12 h-12 text-white mx-auto mb-2" />
                        <p className="text-white font-bold tracking-widest text-center">PAUSED</p>
                    </div>
                 )}
              </div>

              {/* Bottom: Status & Transcript Preview (Debug/Feedback) */}
              <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-2">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold w-fit ${isRecording ? (isPaused ? 'bg-amber-500 text-white' : 'bg-red-500 text-white animate-pulse') : 'bg-gray-800/50 text-white'}`}>
                          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white' : 'bg-gray-400'}`}></div>
                          {isRecording ? (isPaused ? 'PAUSED' : 'REC') : 'STANDBY'}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold w-fit bg-blue-500/80 text-white backdrop-blur-sm">
                          AI STATUS: {liveStatus.toUpperCase()}
                      </div>
                  </div>
              </div>
           </div>
        </div>

        {/* Controls Side Panel (Desktop) / Bottom Panel (Mobile) */}
        <div className="w-full md:w-64 flex flex-col gap-4">
           
           {!isRecording ? (
             <button 
                onClick={startRecording}
                disabled={!stream || !apiKey}
                className="w-full py-4 bg-pastel-slate text-white rounded-2xl font-bold text-lg hover:bg-gray-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <Camera className="w-6 h-6" />
                Start Interview
             </button>
           ) : (
             <>
                <div className="flex gap-4">
                    <button 
                        onClick={togglePause}
                        className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all shadow-md flex items-center justify-center gap-2 ${isPaused ? 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100'}`}
                    >
                        {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                        {isPaused ? "Resume" : "Pause"}
                    </button>

                    <button 
                        onClick={stopRecording}
                        className="flex-1 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-bold text-lg hover:bg-red-100 transition-all shadow-md flex items-center justify-center gap-2"
                    >
                        <Square className="w-5 h-5 fill-current" />
                        Stop
                    </button>
                </div>

                <button 
                  onClick={nextQuestion}
                  className="w-full py-4 bg-pastel-mint text-emerald-800 border border-emerald-100 rounded-2xl font-bold text-lg hover:bg-emerald-100 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  Next Question <ChevronRight className="w-5 h-5" />
                </button>
             </>
           )}

           {!apiKey && (
             <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
               ⚠️ API Key missing. Please check configuration.
             </div>
           )}

           <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                 <h3 className="font-bold text-gray-400 text-xs uppercase">Live Transcript</h3>
                 <button 
                    onClick={() => downloadJSON()} 
                    title="Download Transcript JSON"
                    disabled={qaPairs.length === 0}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                 >
                    <Download className="w-3 h-3" />
                    JSON
                 </button>
              </div>
              <div className="h-48 overflow-y-auto text-sm text-gray-600 leading-relaxed no-scrollbar p-2 bg-gray-50 rounded-xl flex-1 border border-gray-100 relative">
                 {isPaused && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded border border-amber-100">Recording Paused</span>
                    </div>
                 )}
                 {currentTranscript || <span className="text-gray-400 italic">Listening...</span>}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Recorder;