import { LngLatBounds } from '@maptiler/sdk'
import { useEffect, useState } from 'react'
import { useMap } from './MapContext'

export function useMapLoading(): boolean {
  const model = useMap()

  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    model.addLoadingChangeListener(setLoading)
  }, [model, model.map])

  return loading
}

export function useMapReady(): boolean {
  const model = useMap()

  const [ready, setReady] = useState<boolean>(false)

  useEffect(() => {
    model.addReadyListener(() => {
      setReady(true)
    })
  }, [model, model.map])

  return ready
}

export function useMapBounds(): LngLatBounds | null {
  const model = useMap()

  const [bounds, setBounds] = useState<LngLatBounds | null>(model.getBounds())

  useEffect(() => {
    model.addBoundsListener(setBounds)
  }, [model, model.map])

  return bounds
}