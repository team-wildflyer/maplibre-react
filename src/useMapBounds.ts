import { LngLatBounds } from '@maptiler/sdk'
import { useEffect, useState } from 'react'
import { useMap } from './MapContext'

export function useMapBounds(): LngLatBounds | null {
  const model = useMap()

  const [bounds, setBounds] = useState<LngLatBounds | null>(model.getBounds())

  useEffect(() => {
    model.addBoundsListener(setBounds)
  }, [model.map])

  return bounds
}