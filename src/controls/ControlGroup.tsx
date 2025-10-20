import { ControlPosition, IControl } from '@maptiler/sdk'
import cn from 'classnames'
import React, { ReactNode, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { memo } from 'react-util'
import { useMap } from '../MapContext'
import { ControlContext } from './ControlContext'

export interface ControlGroupProps {
  position:  ControlPosition
  children?: ReactNode
}

export const ControlGroup = memo('ControlGroup', (props: ControlGroupProps) => {

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

    map.addRootControl(control, position)
    return () => {
      map.removeRootControl(control)
    }
  }, [container, map, position, props.position])

  function render() {
    return createPortal((
      <ControlContext.Provider value={childContext}>
        <div className={cn('maplibre-react--ControlGroup', position)}>
          {children}
        </div>
      </ControlContext.Provider>
    ), container)
  }

  return render()

})

const childContext: ControlContext = {root: false}