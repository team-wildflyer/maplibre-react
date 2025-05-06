import React, { ReactNode, useEffect, useMemo } from 'react'
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
    []
  ))
  
  useEffect(() => {
    return () => { map.deinit() }
  }, [map])
  
  return (
    <MapContext.Provider value={map} {...props}/>
  )

})