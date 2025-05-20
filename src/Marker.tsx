import { MarkerOptions } from '@maptiler/sdk'
import cn from 'classnames'
import { Point } from 'geojson'
import { Geometry } from 'geojson-classes'
import React, { ReactNode, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { memo } from 'react-util'
import { useBoolean } from 'react-util/hooks'
import { useMap } from './MapContext'

export interface MarkerProps {
  id:        string
  location:  Geometry<Point>
  visible?:  boolean
  anchor?:   MarkerOptions['anchor']
  options?:  Omit<MarkerOptions, 'anchor' | 'location'>
  children?: ReactNode
}

export const Marker = memo('Marker', (props: MarkerProps) => {

  const {
    id,
    location,
    visible = true,
    anchor,
    options,
    children,
  } = props

  const container = useMemo(() => {
    return document.createElement('div')
  }, [])

  const [added, markAdded] = useBoolean(false)
  const hidden = !added || !visible

  const {addMarker} = useMap()
  const optionsRef = useRef(options)

  useEffect(() => {
    addMarker(
      id,
      location,
      container, {
        anchor,
        ...optionsRef.current,
      },
      markAdded
    )
  }, [addMarker, id, location, markAdded, container, anchor])

  return createPortal((
    <div className={cn('maplibre-react--Marker', {hidden})}>
      {children}
    </div>
  ), container)

})