import { omit } from 'lodash'
import { ReactNode, useEffect } from 'react'
import { memo } from 'react-util'
import { useMap } from '../MapContext'
import { LayerGroupOrdering } from '../types'

export type LayerGroupProps = LayerGroupCommonProps & LayerGroupOrdering

export interface LayerGroupCommonProps {
  name:      string
  children?: ReactNode
}

export const LayerGroup = memo('LayerGroup', (props: LayerGroupProps) => {

  const name = props.name
  const positioning = omit(props, 'name') as LayerGroupOrdering

  const map = useMap()

  useEffect(
    () => map.registerLayerGroup(name, positioning),
    [map, name, positioning]
  )

  return null

})
