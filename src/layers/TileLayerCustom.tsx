import { CustomLayerInterface } from '@maptiler/sdk'
import { useEffect, useMemo } from 'react'
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
  const {registerTileBackingLayer} = useMap()

  const backingLayer = useMemo(
    () => create(layer.name),
    [create, layer.name],
  )

  useEffect(() => {
    return registerTileBackingLayer(backingLayer, {
      group: group?.name,
    })
  })

  return null

})