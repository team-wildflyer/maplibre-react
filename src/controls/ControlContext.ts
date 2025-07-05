import { createContext } from 'react'

export interface ControlContext {
  root: boolean
}

export const ControlContext = createContext<ControlContext>({
  root: true,
})