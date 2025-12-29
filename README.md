# Memoria: AI-Powered Digital Twin Recorder

**Memoria** is an empathetic, AI-driven video biography application designed to capture life stories, wisdom, and personality. Powered by Google's Gemini Multimodal Live API, it acts as a patient, curious interviewer that helps users build a "Digital Twin" of themselves through guided conversation.



## 🧠 For Families & Dementia Care

While Memoria is a powerful tool for anyone wishing to leave a legacy, it was designed with a specific mission: **supporting individuals facing early-stage dementia, Alzheimer's, or cognitive decline.**

### The Philosophy: Reminiscence Therapy & Dignity
As memory begins to fade, anxiety often increases. "Reminiscence Therapy"—the discussion of past activities, events, and experiences—is a proven method to improve mood and cognitive agility in older adults.

**How Memoria helps:**

1.  **Preservation of Self:** For those diagnosed with dementia, the fear of losing one's identity is profound. Memoria captures the user's voice, mannerisms, laughs, and stories while they are still vivid, creating a permanent artifact of *who they are*.
2.  **The Infinite Patience of AI:** Human caregivers are often exhausted. They may not have the energy to ask "And then what happened?" for the tenth time. The AI host is infinitely patient, gentle, and enthusiastic. It never gets tired, frustrated, or bored.
3.  **Prompting & Scaffolding:** Cognitive decline can make it hard to maintain a train of thought. Memoria doesn't just record; it listens. If a user trails off or struggles to find a word, the AI gently interjects with a specific, supportive follow-up question to help them continue their story without feeling embarrassed.
4.  **Multimodal Legacy:** The application saves both high-quality video and a text transcript. This data can serve as a "Digital Twin" foundation—allowing future generations to "interact" with the stories and wisdom of their loved ones long after they are gone.

---

## 🛠 Features

*   **Real-time AI Interviewer:** Uses Gemini Live API to listen to audio/video input and respond verbally with relevant follow-up questions.
*   **Adaptive Conversations:** The AI detects pauses and context, offering encouragement ("That sounds beautiful, tell me more about the house...") rather than generic prompts.
*   **Curated Life Review:** Includes a database of psychological "Life Review" questions designed to elicit deep memories.
*   **Privacy First:** API keys are handled securely. Video processing happens locally in the browser where possible, and recordings are downloaded directly to the user's device.
*   **Accessible UI:** High contrast, large buttons, and calm "Pastel" aesthetics designed for seniors and non-technical users.

---

## 💻 Technical Stack

*   **Frontend:** React 19, TypeScript, Vite
*   **AI Model:** Google Gemini 2.5 Flash (via `@google/genai` SDK)
*   **Styling:** Tailwind CSS (Pastel theme)
*   **Audio/Video:** Web Audio API (AudioWorklets/ScriptProcessor), MediaRecorder API

---

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   A Google Cloud Project with the **Gemini API** enabled.
*   An API Key from [Google AI Studio](https://aistudio.google.com/).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ecorpnu/memo.git

    cd memo
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory:
    ```env
    VITE_API_KEY=your_google_gemini_api_key_here
    ```

4.  **Run the application:**
    ```bash
    npm run dev
    ```

5.  Open your browser to the local host link provided (usually `http://localhost:5173`).

---

## 🔒 Privacy & Data

This application deals with highly personal biometric data (face and voice).
*   **No backend storage:** This is a client-side only application. Videos are generated in the browser and downloaded directly to the user's hard drive.
*   **API Usage:** Audio data is streamed to Google's Gemini API for processing. Please refer to Google's [GenAI Data Privacy terms](https://ai.google.dev/gemini-api/terms).

---

## 🤝 Contributing

We welcome contributions, especially those improving accessibility for elderly users (WCAG compliance) or adding new language support for diverse families.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

*Memoria: Because every story deserves to be remembered.*
