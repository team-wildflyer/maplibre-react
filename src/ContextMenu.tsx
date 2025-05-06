import { MapMouseEvent } from '@maptiler/sdk'
import { Point } from 'geojson'
import { Geometry } from 'geojson-classes'
import { isFunction } from 'lodash'
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { memo } from 'react-util'
import { useBoolean } from 'react-util/hooks'
import { useMap } from './MapContext'

export interface ContextMenuProps {
  onOpen?:  (point: Geometry<Point>, clientPoint: ClientPoint, event: MapMouseEvent) => void
  onClose?: () => void

  children?:     ReactNode | ((props: ChildProps) => ReactNode)
  renderMarker?: ReactNode | ((props: ChildProps) => ReactNode)
}

export interface ChildProps {
  isOpen:       boolean
  requestClose: () => void

  point:       Geometry<Point> | null
  clientPoint: ClientPoint | null
}

export interface ClientPoint {
  x: number
  y: number
}

export const ContextMenu = memo('ContextMenu', (props: ContextMenuProps) => {

  const {
    onOpen,
    onClose,
    children,
    renderMarker,
  } = props

  const map = useMap()
  const [isOpen, open, state_close] = useBoolean()

  // #region Actions

  const [point, setPoint] = useState<Geometry<Point> | null>(null)
  const [clientPoint, setClientPoint] = useState<ClientPoint | null>(null)

  useEffect(() => {
    if (map == null) { return }

    return map.on('contextmenu', (event: MapMouseEvent) => {
      if (map.element == null) { return }

      const point = Geometry.point([event.lngLat.lng, event.lngLat.lat])
      const mapRect = map.element.getBoundingClientRect()
      const clientPoint: ClientPoint = {
        x: event.point.x + mapRect.left,
        y: event.point.y + mapRect.top,
      }

      setPoint(point)
      setClientPoint(clientPoint)
      onOpen?.(point, clientPoint, event)
      open()
    })
  }, [map, onOpen, open])

  const close = useCallback(() => {
    state_close()
    onClose?.()
  }, [onClose, state_close])

  useEffect(() => {
    if (!isOpen) { return }
    return map.on('movestart', close)
  }, [close, isOpen, map])

  const marker = useMemo(
    () => renderMarker == null ? null : document.createElement('div'),
    [renderMarker]
  )

  useEffect(() => {
    if (marker == null) { return }
    if (map.element == null) { return }
    if (!isOpen) { return }
    if (point == null) { return }

    return map.addMarker('contextmenu-marker', point, marker, {
      anchor: 'center',
    })
  }, [isOpen, map, marker, point])

  // #endregion

  const childProps: ChildProps = useMemo(() => ({
    isOpen,
    requestClose: close,

    clientPoint,
    point,
  }), [clientPoint, close, isOpen, point])

  return (
    <>
      {isFunction(children) ? children(childProps) : children}
      {renderMarker != null && marker != null && createPortal(
        isFunction(renderMarker) ? renderMarker(childProps) : renderMarker,
        marker
      )}
    </>
  )

})