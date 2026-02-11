# Memoria - Digital Biographer (Groq Version)

A React application for recording and transcribing personal memories with AI-powered interviewer interjections, now powered by Groq AI.

## Migration from Google Gemini to Groq

This version has been migrated from Google's Gemini AI Studio to Groq API. Here are the key changes:

### Changes Made

1. **Replaced AI Provider**
   - Removed: `@google/genai` package
   - Added: `groq-sdk` package

2. **Updated Live Session Hook** (`hooks/useLiveSession.ts`)
   - Now uses Groq's Whisper API for audio transcription
   - Uses Groq's `llama-3.3-70b-versatile` model for chat completions
   - Implements chunk-based audio transcription (3-second intervals)
   - Detects silence and generates AI responses after 5 seconds of quiet

3. **API Key Management**
   - Removed AI Studio specific code
   - Uses environment variable `VITE_API_KEY` or manual input
   - Set `dangerouslyAllowBrowser: true` for client-side API calls (see Security Note below)

4. **Model Details**
   - **Transcription**: `whisper-large-v3-turbo` (Groq's Whisper model)
   - **Chat/Responses**: `llama-3.3-70b-versatile` (Groq's LLaMA model)

### Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Get Your Groq API Key**
   - Visit [console.groq.com](https://console.groq.com)
   - Create an account and generate an API key

3. **Set Up Environment Variable**
   Create a `.env` file in the project root:
   ```env
   VITE_API_KEY=your_groq_api_key_here
   ```

4. **Run the Application**
   ```bash
   npm run dev
   ```

### Security Note ⚠️

The current implementation uses `dangerouslyAllowBrowser: true` to allow Groq API calls directly from the browser. This is **NOT recommended for production** as it exposes your API key.

**For Production:**
- Create a backend proxy server to handle Groq API calls
- Never expose API keys in client-side code
- Use environment variables only on the server side

Example backend setup (Node.js/Express):
```javascript
app.post('/api/transcribe', async (req, res) => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  // Handle transcription here
});
```

### Features

- ✅ Real-time audio recording and transcription
- ✅ AI-powered interviewer that asks follow-up questions
- ✅ Customizable question sets (JSON/TXT upload)
- ✅ Multiple aspect ratio support (Portrait, Landscape, Square, 3:4)
- ✅ Live transcript display
- ✅ Export transcripts as JSON
- ✅ Pause/Resume functionality

### How It Works

1. **Audio Capture**: Records audio in 3-second chunks using MediaRecorder API
2. **Transcription**: Sends audio chunks to Groq's Whisper API for transcription
3. **AI Response**: After 5 seconds of silence, sends transcript to LLaMA model for follow-up questions
4. **Display**: Shows live transcript and AI interviewer interjections in real-time

### Limitations

- Browser-based API calls (security concern for production)
- 3-second chunking may cause slight delays in transcription
- Conversation history limited to last 20 exchanges to manage context window

### Cost Considerations

Groq pricing (as of creation):
- Whisper API: Very affordable for transcription
- LLaMA 3.3 70B: Pay per token for completions

Check [Groq's pricing page](https://groq.com/pricing) for current rates.

### Troubleshooting

**"No API Key provided" error:**
- Ensure `.env` file exists with `VITE_GROQ_API_KEY`
- Restart dev server after adding environment variables

**Transcription not working:**
- Check browser console for CORS or API errors
- Verify API key is valid at console.groq.com
- Ensure microphone permissions are granted

**AI not responding:**
- Check that transcription is working first
- Verify API key has access to chat completions
- Look for rate limit errors in console

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### License

See `license.txt` for details.

## Original Project

This is a modified version of the Memoria app, originally built for Google's Gemini AI Studio.
