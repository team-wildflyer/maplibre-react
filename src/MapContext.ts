import { createContext, useContext } from 'react'
import { MapModel } from './MapModel'

export const MapContext = createContext<MapModel | null>(null)

export function useMap() {
  const context = useContext(MapContext)
  if (context == null) {
    throw new Error('useMap must be used within a MapContainer')
  }

  return context
}