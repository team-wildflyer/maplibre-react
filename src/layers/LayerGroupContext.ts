import { createContext, useContext } from 'react'

export interface LayerGroupContext {
  name: string
}

export const LayerGroupContext = createContext<LayerGroupContext | null>(null)

export function useLayerGroup() {
  return useContext(LayerGroupContext)
}