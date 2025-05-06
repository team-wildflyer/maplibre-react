import { ControlPosition, IControl } from '@maptiler/sdk'
import cn from 'classnames'
import { useMap } from 'maplibre-react'
import { ReactNode, useEffect, useMemo } from 'react'
import React, { createPortal } from 'react-dom'
import { memo } from 'react-util'

export interface ControlZoneProps {
  position:  ControlPosition
  children?: ReactNode
}

export const ControlZone = memo('ControlZone', (props: ControlZoneProps) => {

  const {position, children} = props
  const map = useMap()

  const container = useMemo(() => {
    return document.createElement('div')
  }, [])

  useEffect(() => {
    const control: IControl = {
      onAdd:    () => container,
      onRemove: () => {},
    }

    map.addControl(control, position)
    return () => {
      map.removeControl(control)
    }
  }, [container, map, position, props.position])

  function render() {
    return createPortal((
      <div className={cn('maplibre-react--ControlZone', position)}>
        {children}
      </div>
    ), container)
  }

  return render()

})