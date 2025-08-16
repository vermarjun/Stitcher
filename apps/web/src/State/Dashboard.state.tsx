import { atom, selector } from 'recoil';

// Types
export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  videoUrl?: string;
  thumbnailUrl?: string;
  status: 'draft' | 'processing' | 'completed' | 'error';
};

export type ExplorerItem = {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'video' | 'project';
  children?: ExplorerItem[];
  size?: number;
  createdAt?: Date;
  projectId?: string;
};

export type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
    processingTime?: number;
  };
};

export type VideoGenerationRequest = {
  id: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  projectId: string;
  createdAt: Date;
  completedAt?: Date;
  videoUrl?: string;
  error?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: 'free' | 'pro' | 'enterprise';
  usage: {
    videosGenerated: number;
    storageUsed: number;
    monthlyLimit: number;
  };
};

// UI State
export const activeMenuState = atom<string>({
  key: 'activeMenuState',
  default: 'projects',
});

export const sidebarExpandedState = atom<boolean>({
  key: 'sidebarExpandedState',
  default: true,
});

export const expandedFoldersState = atom<Set<string>>({
  key: 'expandedFoldersState',
  default: new Set(['folder_123', 'folder_456']),
});

export const selectedItemState = atom<string | null>({
  key: 'selectedItemState',
  default: 'project_789',
});

export const searchQueryState = atom<string>({
  key: 'searchQueryState',
  default: 'marketing video',
});

export const currentViewState = atom<'projects' | 'templates' | 'videos'>({
  key: 'currentViewState',
  default: 'projects',
});

// API KEYS
export type ServiceType = 'openai' | 'anthropic' | 'cohere' | 'mistral' | 'gemini';

export interface IApiKey {
  _id: string;
  userId?: string;
  name: string;
  key?: string;
  service: ServiceType;
  weight: number;
  isActive: boolean;
  apicalls: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyFormData {
  name: string;
  key: string;
  service: ServiceType | '';
  weight: number;
}

export const apiKeysState = atom<IApiKey[]>({
  key: 'apiKeysState',
  default: [],
});

export const apiKeysLoadingState = atom<boolean>({
  key: 'apiKeysLoadingState',
  default: false,
});

// Data State
export const userState = atom<User | null>({
  key: 'userState',
  default: {
    id: 'user_12345',
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    plan: 'pro',
    usage: {
      videosGenerated: 12,
      storageUsed: 4.7,
      monthlyLimit: 20
    }
  },
});

export const projectsState = atom<Project[]>({
  key: 'projectsState',
  default: [
    {
      id: 'project_789',
      name: 'Marketing Campaign',
      description: 'Summer product launch video',
      createdAt: new Date('2023-05-15'),
      updatedAt: new Date('2023-05-20'),
      status: 'completed',
      videoUrl: 'https://example.com/videos/marketing_campaign.mp4',
      thumbnailUrl: 'https://example.com/thumbnails/marketing_campaign.jpg'
    },
    {
      id: 'project_101',
      name: 'Training Video',
      description: 'New employee onboarding',
      createdAt: new Date('2023-06-01'),
      updatedAt: new Date('2023-06-10'),
      status: 'processing'
    },
    {
      id: 'project_202',
      name: 'Product Demo',
      createdAt: new Date('2023-06-15'),
      updatedAt: new Date('2023-06-15'),
      status: 'draft'
    }
  ],
});

export const currentProjectState = atom<Project | null>({
  key: 'currentProjectState',
  default: {
    id: 'project_789',
    name: 'Marketing Campaign',
    description: 'Summer product launch video',
    createdAt: new Date('2023-05-15'),
    updatedAt: new Date('2023-05-20'),
    status: 'completed',
    videoUrl: 'https://example.com/videos/marketing_campaign.mp4',
    thumbnailUrl: 'https://example.com/thumbnails/marketing_campaign.jpg'
  },
});

export const explorerItemsState = atom<ExplorerItem[]>({
  key: 'explorerItemsState',
  default: [
    {
      id: 'folder_123',
      name: 'Assets',
      type: 'folder',
      children: [
        {
          id: 'file_456',
          name: 'background_music.mp3',
          type: 'file',
          size: 3.2,
          createdAt: new Date('2023-05-16')
        },
        {
          id: 'file_789',
          name: 'logo.png',
          type: 'file',
          size: 0.5,
          createdAt: new Date('2023-05-16')
        }
      ]
    },
    {
      id: 'folder_456',
      name: 'Videos',
      type: 'folder',
      children: [
        {
          id: 'video_101',
          name: 'first_draft.mp4',
          type: 'video',
          size: 45.7,
          createdAt: new Date('2023-05-17'),
          projectId: 'project_789'
        }
      ]
    },
    {
      id: 'file_202',
      name: 'script.docx',
      type: 'file',
      size: 0.8,
      createdAt: new Date('2023-05-15')
    }
  ],
});

export const chatMessagesState = atom<Message[]>({
  key: 'chatMessagesState',
  default: [
    {
      id: 'msg_1685123456789_abc123',
      content: 'Can you create a 30-second video about our new product?',
      role: 'user',
      timestamp: new Date('2023-05-25T10:15:00'),
      metadata: {
        tokens: 15,
        model: 'gpt-4',
        processingTime: 1200
      }
    },
    {
      id: 'msg_1685123467890_def456',
      content: 'Sure! I can generate a product demo video. What key features would you like to highlight?',
      role: 'assistant',
      timestamp: new Date('2023-05-25T10:16:00'),
      metadata: {
        tokens: 22,
        model: 'gpt-4',
        processingTime: 1800
      }
    }
  ],
});

export const videoGenerationQueueState = atom<VideoGenerationRequest[]>({
  key: 'videoGenerationQueueState',
  default: [],
});

export const isLoadingState = atom<boolean>({
  key: 'isLoadingState',
  default: false,
});

export const errorState = atom<string | null>({
  key: 'errorState',
  default: null,
});

// Selectors (remain unchanged as they compute derived state)
export const filteredProjectsSelector = selector({
  key: 'filteredProjectsSelector',
  get: ({ get }) => {
    const projects = get(projectsState);
    const searchQuery = get(searchQueryState);
    
    if (!searchQuery.trim()) return projects;
    
    return projects.filter(project =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  },
});

export const currentProjectExplorerItemsSelector = selector({
  key: 'currentProjectExplorerItemsSelector',
  get: ({ get }) => {
    const explorerItems = get(explorerItemsState);
    const currentProject = get(currentProjectState);
    
    if (!currentProject) return explorerItems;
    
    return explorerItems.filter(item => 
      item.projectId === currentProject.id || item.type === 'folder'
    );
  },
});

export const activeVideoGenerationsSelector = selector({
  key: 'activeVideoGenerationsSelector',
  get: ({ get }) => {
    const queue = get(videoGenerationQueueState);
    return queue.filter(req => req.status === 'processing' || req.status === 'pending');
  },
});

export const userUsageSelector = selector({
  key: 'userUsageSelector',
  get: ({ get }) => {
    const user = get(userState);
    if (!user) return null;
    
    return {
      ...user.usage,
      percentageUsed: (user.usage.videosGenerated / user.usage.monthlyLimit) * 100,
      remainingGenerations: Math.max(0, user.usage.monthlyLimit - user.usage.videosGenerated),
    };
  },
});

// Actions (remain unchanged)
export const projectActions = {
  createProject: (name: string, description?: string): Project => ({
    id: `project_${Date.now()}`,
    name,
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft',
  }),

  updateProjectStatus: (projectId: string, status: Project['status']) => ({
    type: 'UPDATE_PROJECT_STATUS',
    payload: { projectId, status },
  }),
};

export const messageActions = {
  createMessage: (content: string, role: Message['role']): Message => ({
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    role,
    timestamp: new Date(),
  }),

  createVideoGenerationRequest: (prompt: string, projectId: string): VideoGenerationRequest => ({
    id: `req_${Date.now()}`,
    prompt,
    status: 'pending',
    progress: 0,
    projectId,
    createdAt: new Date(),
  }),
};

