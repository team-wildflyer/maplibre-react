import { useEffect, useState } from 'react'
import { useMap } from './MapContext'

export function useMapLoading(): boolean {
  const model = useMap()

  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    model.addLoadingListener(setLoading)
  }, [model, model.map])

  return loading
}