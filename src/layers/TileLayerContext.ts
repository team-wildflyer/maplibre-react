import { createContext, useContext } from 'react'

export interface TileLayerContext {
  name: string
}

export const TileLayerContext = createContext<TileLayerContext | null>(null)

export function useTileLayer() {
  const context = useContext(TileLayerContext)
  if (context == null) {
    throw new Error('Must be used within a TileLayer')
  }

  return context
}