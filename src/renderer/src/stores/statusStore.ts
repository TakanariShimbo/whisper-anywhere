import { create } from 'zustand'
import type { AppStatus, StatusPayload } from '@shared/events'

interface StatusState {
  status: AppStatus
  text?: string
  error?: string
  set(payload: StatusPayload): void
}

export const useStatusStore = create<StatusState>((set) => ({
  status: 'idle',
  text: undefined,
  error: undefined,
  set(payload) {
    set({ status: payload.status, text: payload.text, error: payload.error })
  }
}))
