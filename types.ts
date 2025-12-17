export enum AspectRatio {
  Portrait = '9:16',
  Landscape = '16:9',
  ThreeFour = '3:4',
  Square = '1:1',
}

export interface Question {
  id: string;
  text: string;
}

export interface QAPair {
  Q: string;
  A: string;
}

export interface LiveConfig {
  model: string;
  systemInstruction: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
