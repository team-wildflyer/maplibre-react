import { ReactNode, useLayoutEffect, useMemo, useState } from 'react'
import { memo } from 'react-util'
import { useDisposable } from 'react-util/hooks'
import { MapContext } from './MapContext'
import { MapModel } from './MapModel'

export interface MapContainerProps {
  children?: ReactNode
}

export const MapContainer = memo('MapContainer', (props: MapContainerProps) => {

  const model = useDisposable(useMemo(
    () => new MapModel(),
    [],
  ))

  const [epoch, setEpoch] = useState(0)

  const context = useMemo(() => ({
    model,
    epoch,
  }), [epoch, model])

  useLayoutEffect(() => {
    setEpoch(prev => prev + 1)
  }, [])
  
  return (
    <MapContext.Provider value={context} {...props}/>
  )

})