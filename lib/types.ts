export type ChatRole = 'user' | 'assistant';

export interface ChatMessageItem {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export type RobotState = 'idle' | 'listening' | 'talking' | 'error';

export interface ChatApiRequest {
  message: string;
  history: Array<{
    role: ChatRole;
    content: string;
  }>;
  stream?: boolean;
}

export interface ChatApiResponse {
  reply: string;
}

export interface ChatApiErrorResponse {
  error: string;
}
