import React, { ReactNode, useMemo } from 'react'
import { memo } from 'react-util'
import { useDisposable } from 'react-util/hooks'
import { MapContext } from './MapContext'
import { MapModel } from './MapModel'

export interface MapContainerProps {
  children?: ReactNode
}

export const MapContainer = memo('MapContainer', (props: MapContainerProps) => {

  const map = useDisposable(useMemo(
    () => new MapModel(),
    [],
  ))
  
  return (
    <MapContext.Provider value={map} {...props}/>
  )

})