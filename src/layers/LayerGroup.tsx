import { omit } from 'lodash'
import React, { ReactNode, useEffect, useMemo } from 'react'
import { memo } from 'react-util'
import { useWithStableDeps } from 'react-util/hooks'
import { useMap } from '../MapContext'
import { LayerGroupOrdering } from '../types'
import { LayerGroupContext } from './LayerGroupContext'

export type LayerGroupProps = LayerGroupCommonProps & LayerGroupOrdering

export interface LayerGroupCommonProps {
  name:      string
  children?: ReactNode
}

export const LayerGroup = memo('LayerGroup', (props: LayerGroupProps) => {

  const {name, children} = props
  
  const positioning = useWithStableDeps(
    omit(props, 'name') as LayerGroupOrdering,
    ordering => ['above' in ordering ? `above-${ordering.above}` : `below-${ordering.below}`],
  )

  const contextValue: LayerGroupContext = useMemo(() => ({
    name,
  }), [name])

  const map = useMap()
  useEffect(
    () => map.registerLayerGroup(name, positioning),
    [map, name, positioning],
  )

  return (
    <LayerGroupContext.Provider value={contextValue}>
      {children}
    </LayerGroupContext.Provider>
  )

})
