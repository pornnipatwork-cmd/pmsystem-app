'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectInfo {
  id: string
  code: string
  name: string
  color: string
}

interface ProjectStore {
  currentProjectId: string | null
  currentProject: ProjectInfo | null
  setCurrentProject: (project: ProjectInfo) => void
  clearProject: () => void
  // Mobile sidebar drawer
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      currentProjectId: null,
      currentProject: null,
      sidebarOpen: false,
      setCurrentProject: (project) =>
        set({ currentProjectId: project.id, currentProject: project }),
      clearProject: () => set({ currentProjectId: null, currentProject: null }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: 'pm-current-project',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        currentProject: state.currentProject,
      }),
    }
  )
)
