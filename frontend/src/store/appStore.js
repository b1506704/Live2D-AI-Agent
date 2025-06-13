import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useAppStore = create(
  devtools(
    persist(
      (set) => ({
        // UI State
        selectedModel: 'Haru',
        language: 'en',
        isRecording: false,
        isProcessing: false,
        transcript: '',
        chatHistory: [],
        
        // Actions
        setSelectedModel: (model) => set({ selectedModel: model }),
        setLanguage: (language) => set({ language }),
        setIsRecording: (isRecording) => set({ isRecording }),
        setIsProcessing: (isProcessing) => set({ isProcessing }),
        setTranscript: (transcript) => set({ transcript }),
        
        addChatMessage: (message) => 
          set((state) => ({ 
            chatHistory: [...state.chatHistory, message] 
          })),
          
        clearChatHistory: () => set({ chatHistory: [] }),
        
        // Settings
        settings: {
          autoPlayAudio: true,
          showSubtitles: true,
          audioVolume: 0.8,
          enableEffects: true,
        },
        
        updateSettings: (newSettings) =>
          set((state) => ({
            settings: { ...state.settings, ...newSettings }
          })),
      }),
      {
        name: 'live2d-ai-agent',
        partialize: (state) => ({
          selectedModel: state.selectedModel,
          language: state.language,
          settings: state.settings,
        }),
      }
    )
  )
);