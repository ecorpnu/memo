# Quick Start Guide - Groq Version

## Setup (5 minutes)

### 1. Get Your Groq API Key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create API Key"
5. Copy your key

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure API Key

**Option A: Environment Variable (Recommended)**
```bash
# Create .env file
echo "VITE_GROQ_API_KEY=your_actual_api_key_here" > .env
```

**Option B: Manual Entry**
- The app will prompt you for the API key when you start it
- Simply paste it when asked

### 4. Run the App
```bash
npm run dev
```

Visit `http://localhost:5173` (or the URL shown in terminal)

## Usage

1. **Grant Permissions**: Allow camera and microphone access when prompted
2. **Start Recording**: Click "Start Recording" button
3. **Answer Questions**: Speak naturally - the app will transcribe your voice
4. **AI Interviewer**: After ~5 seconds of silence, the AI will ask follow-up questions
5. **Navigate**: Use "Next Question" to move to the next prompt
6. **Pause/Resume**: Pause recording at any time
7. **Export**: Download your transcript as JSON

## What to Expect

- **Transcription Delay**: ~3 seconds for audio chunks to process
- **AI Response**: Appears after 5 seconds of silence
- **Models Used**: 
  - Whisper Large V3 Turbo (transcription)
  - LLaMA 3.3 70B (AI responses)

## Troubleshooting

### "No API Key provided"
- Check your `.env` file exists
- Restart the dev server
- Verify the key starts with `gsk_`

### Microphone not working
- Check browser permissions
- Try a different browser (Chrome/Edge recommended)
- Make sure no other app is using the microphone

### Transcription not showing
- Open browser console (F12) and check for errors
- Verify API key is valid
- Check your Groq account has credits

## Next Steps

- Upload custom questions (JSON or TXT)
- Try different aspect ratios in settings
- Export and save your memories

## Need Help?

Check the full [README.md](./README.md) for detailed documentation or the [MIGRATION.md](./MIGRATION.md) for technical details about the Groq integration.
