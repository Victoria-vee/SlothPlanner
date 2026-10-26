import { createContext, useContext } from 'react'

export const TimerContext = createContext(null)

export function useFocusTimer() {
  const value = useContext(TimerContext)
  if (!value) throw new Error('useFocusTimer must be used inside <TimerProvider>')
  return value
}
