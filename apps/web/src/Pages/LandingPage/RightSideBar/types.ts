export interface IAssistant {
    plannerOutput: string;
    llmResponse: string;
}

export interface Scene {
    sceneName: string;
    prompt: string;
    summary: string;
    code: string;
    assetId: any | null;
    error: string | null;
    url?: string;
    thumbnail?: string;
    duration?: number;
}

export type Message = {
    _id?: string;
    content: string | IAssistant;
    role: "user" | "assistant";
    timestamp: string | Date;
    scenes: Scene[];
    projectDescription: string;
    completed: boolean;
    plannerOut: boolean;
    generatorOutput: boolean;
};

export const messageActions = {
    createMessage: (
        content: string,
        role: Message["role"]
    ): Message => ({
        _id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        role,
        timestamp: new Date().toISOString(),
        scenes: [],
        projectDescription: '',
        completed: role === 'user',
        plannerOut: false,
        generatorOutput: false,
    })
};

export type GenerationStage = 'idle' | 'planning' | 'generating' | 'rendering' | 'complete';

