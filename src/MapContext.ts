import { createContext, useContext } from 'react'
import { MapModel } from './MapModel'

export interface MapContext {
  model: MapModel | null
  epoch: number
}

export const MapContext = createContext<MapContext>({
  model: null,
  epoch: 0,
})

export function useMap() {
  const {model} = useContext(MapContext)
  if (model == null) {
    throw new Error('useMap must be used within a MapContainer')
  }

  return model
}

export function useMapEpoch() {
  const {epoch} = useContext(MapContext)
  return epoch
}