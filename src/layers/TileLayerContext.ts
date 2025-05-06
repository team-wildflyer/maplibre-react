import { createContext, useContext } from 'react'
import { Layer } from '~/stores/map'

export interface TileLayerContext {
  layer:   Layer
  visible: boolean
}

export const TileLayerContext = createContext<TileLayerContext | null>(null)

export function useTileLayer() {
  const context = useContext(TileLayerContext)
  if (context == null) {
    throw new Error('Must be used within a TileLayer')
  }

  return context
}