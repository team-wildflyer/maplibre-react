import { CustomLayerInterface } from '@maptiler/sdk'
import { useEffect } from 'react'
import { memo } from 'react-util'
import { useMap } from '../MapContext'
import { useLayerGroup } from './LayerGroupContext'
import { useTileLayer } from './TileLayerContext'

export interface TileLayerCustomProps {
  create: (id: string) => CustomLayerInterface
}

export const TileLayerCustom = memo('TileLayerCustom', (props: TileLayerCustomProps) => {

  const {create} = props

  const layer = useTileLayer()
  const group = useLayerGroup()
  const map = useMap()

  useEffect(() => {
    const backingLayer = create(layer.name)
    return map.ensureBackingLayer(layer.name, backingLayer, {
      group: group?.name,
    })
  }, [create, group, layer, map])

  return null

})