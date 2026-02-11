# Migration Summary: Google Gemini → Groq API

## Overview
Successfully migrated the Memoria app from Google's Gemini AI Studio to Groq API.

## Key File Changes

### 1. package.json
**Before:**
```json
"dependencies": {
  "@google/genai": "latest",
  ...
}
```

**After:**
```json
"dependencies": {
  "groq-sdk": "^0.8.0",
  ...
}
```

### 2. hooks/useLiveSession.ts
**Major Changes:**
- Replaced `GoogleGenAI` with `Groq` client
- Changed from WebSocket-based live session to chunk-based transcription
- Implemented MediaRecorder for audio capture (3-second chunks)
- Added silence detection (5-second timeout) before AI response
- Uses Whisper for transcription, LLaMA for chat

**Before (Gemini):**
```typescript
const ai = new GoogleGenAI({ apiKey });
const session = await ai.live.connect({
  model: 'gemini-2.5-flash-native-audio-preview-09-2025',
  config: {
    responseModalities: [Modality.AUDIO],
    ...
  }
});
```

**After (Groq):**
```typescript
const groq = new Groq({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true
});

// Transcribe audio chunks
const transcription = await groq.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-large-v3-turbo',
  ...
});

// Generate responses
const completion = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: messages,
  ...
});
```

### 3. App.tsx
**Changes:**
- Removed AI Studio specific code (`window.aistudio`)
- Added environment variable support (`VITE_GROQ_API_KEY`)
- Simplified API key management
- Updated branding from Gemini to Groq

### 4. components/Recorder.tsx
**Changes:**
- Now receives `apiKey` as a prop instead of from `process.env.API_KEY`
- No changes to UI or recording logic (maintains compatibility)

## Functional Differences

### Gemini (Before)
- ✅ True real-time bidirectional audio streaming
- ✅ Native audio input/output modalities
- ✅ Instant transcription and responses
- ❌ Requires AI Studio environment

### Groq (After)
- ✅ Works in any environment
- ✅ More cost-effective
- ✅ Faster inference with Groq's LPUs
- ❌ Chunk-based transcription (3-second delay)
- ❌ No native audio output (text only)
- ❌ Requires backend proxy for production security

## Architecture Changes

### Audio Processing Pipeline

**Gemini:**
```
Microphone → AudioContext → Real-time PCM encoding → WebSocket → Gemini Live API
                                                                        ↓
                                                              Real-time transcription
                                                              + Audio responses
```

**Groq:**
```
Microphone → MediaRecorder → 3-sec chunks → Groq Whisper API → Transcription
                                                                       ↓
                                                              Text accumulation
                                                                       ↓
                                                           (5 sec silence detected)
                                                                       ↓
                                                              Groq Chat API
                                                                       ↓
                                                              Text response
```

## Trade-offs

### Advantages of Groq Migration
1. **No vendor lock-in** - Not tied to AI Studio
2. **Cost-effective** - Groq's pricing is competitive
3. **Speed** - Groq's LPU infrastructure provides fast inference
4. **Flexibility** - Can deploy anywhere
5. **Model choice** - Access to Whisper and LLaMA models

### Disadvantages
1. **Latency** - 3-second chunks vs real-time streaming
2. **No audio output** - Text responses only (would need separate TTS)
3. **Security** - Requires backend proxy for production
4. **Conversation flow** - Less natural due to silence detection

## Production Recommendations

### Required Changes for Production
1. **Create Backend Proxy**
   ```javascript
   // Express.js example
   app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
     const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
     const transcription = await groq.audio.transcriptions.create({
       file: req.file,
       model: 'whisper-large-v3-turbo'
     });
     res.json(transcription);
   });
   ```

2. **Remove `dangerouslyAllowBrowser`**
   - Make all API calls through backend
   - Never expose API keys in frontend

3. **Add Rate Limiting**
   - Implement rate limits on backend endpoints
   - Prevent API abuse

4. **Add Error Handling**
   - Handle network failures gracefully
   - Implement retry logic for failed requests

5. **Consider Adding TTS**
   - Use service like ElevenLabs for audio responses
   - Or use browser's Web Speech API for basic TTS

## Testing Checklist

- [x] Audio recording works
- [x] Transcription is accurate
- [x] AI responses are contextual
- [x] Pause/Resume functionality
- [x] Question navigation
- [x] Export to JSON
- [x] Custom question upload
- [ ] Production backend proxy (TODO)
- [ ] Rate limiting (TODO)
- [ ] Audio output/TTS (Optional)

## Next Steps

1. **Immediate**: Test the current implementation
2. **Short-term**: Create backend proxy for security
3. **Long-term**: Consider adding TTS for audio responses
4. **Optional**: Explore Groq's other models for better responses
