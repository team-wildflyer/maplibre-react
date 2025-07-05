import { ControlPosition } from '@maptiler/sdk'
import React, { ReactNode, Ref, useContext } from 'react'
import { forwardRef } from 'react-util'
import { ControlContext } from './ControlContext'
import { ControlGroup } from './ControlGroup'

export interface ControlProps {
  position?: ControlPosition
  children?: ReactNode
}

/**
 * A wrapper for any map control component. You can either add the component directly to a `<Map/>` element,
 * in which case the `position` prop is required, or you can add it to a `<ControlGroup/>` component for
 * control grouping.
 */
export const Control = forwardRef('Control', (props: ControlProps, ref: Ref<HTMLDivElement>) => {

  const {position, children} = props
  const root = useContext(ControlContext).root

  function render() {
    if (!root) {
      return <>{renderContent()}</>
    } else if (position == null) {
      throw new Error('Control must have a position when used as a root control')
    }

    return (
      <ControlGroup position={position}>
        {renderContent()}
      </ControlGroup>
    )
  }

  function renderContent() {
    if (ref == null) {
      return <>{children}</>
    } else {
      return (
        <div ref={ref} className='maplibre-react--Control'>
          {children}
        </div>
      )
    }
  }

  return render()

})