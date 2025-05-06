import cn from 'classnames'
import React, { ReactNode, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { memo } from 'react-util'
import { useBoolean } from 'react-util/hooks'
import { useMap } from './MapContext'

export interface MarkerProps {
  id:        string
  location:  GeoJSON.Point
  children?: ReactNode
  visible?:  boolean
}

export const Marker = memo('Marker', (props: MarkerProps) => {

  const {
    id,
    location,
    visible = true,
    children,
  } = props

  const container = useMemo(() => {
    return document.createElement('div')
  }, [])

  const [added, markAdded] = useBoolean(false)
  const hidden = !added || !visible

  const {addMarker} = useMap()

  useEffect(
    () => addMarker(id, location, container, {}, markAdded),
    [addMarker, id, location, markAdded, container]
  )

  return createPortal((
    <div className={cn('maplibre-react--Marker', {hidden})}>
      {children}
    </div>
  ), container)

})