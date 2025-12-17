import { Question } from '../types';

export const DEFAULT_QUESTIONS: Question[] = [
  { id: '1', text: "Right now, across a typical week, how do your days vary?" },
  { id: '2', text: "What is your earliest memory that feels completely vivid?" },
  { id: '3', text: "Describe a moment in your life where you felt truly at peace." },
  { id: '4', text: "What is a lesson you learned the hard way?" },
  { id: '5', text: "If you could speak to your younger self, what advice would you give?" },
  { id: '6', text: "Describe a major financial decision you made in the past. What factors influenced your choice the most?" },
  { id: '7', text: "Think of a time you had to choose between two distinct career paths or job offers. How did you decide?" },
  { id: '8', text: "When faced with a high-stakes risk, such as a large investment or a career pivot, do you trust your gut or the data? Give an example." },
  { id: '9', text: "Have you ever made a decision that prioritized long-term stability over short-term gain? Tell me about that experience." },
  { id: '10', text: "Reflect on a time you had to negotiate for your worth, financially or professionally. How did you handle the pressure?" },
];

export const parseQuestionsFile = async (file: File): Promise<Question[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        let parsed: any;
        
        // Try JSON first
        try {
          parsed = JSON.parse(content);
        } catch {
          // Fallback to splitting by newlines
          parsed = content.split('\n').filter(line => line.trim().length > 0).map(line => ({ text: line }));
        }

        let questions: Question[] = [];

        if (Array.isArray(parsed)) {
           questions = parsed.map((item, index) => {
             if (typeof item === 'string') return { id: `custom-${index}`, text: item };
             if (typeof item === 'object' && item.text) return { id: item.id || `custom-${index}`, text: item.text };
             return null;
           }).filter((q): q is Question => q !== null);
        }

        // Limit to 100
        resolve(questions.slice(0, 100));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};