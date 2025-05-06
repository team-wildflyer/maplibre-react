import { CustomLayerInterface } from '@maptiler/sdk'
import { useEffect, useRef } from 'react'
import { memo } from 'react-util'
import { useMap } from '~/ui/hooks'
import { useTileLayer } from './TileLayerContext'

export interface TileLayerCustomProps {
  create: (id: string) => CustomLayerInterface
}

export const TileLayerCustom = memo('TileLayerCustom', (props: TileLayerCustomProps) => {

  const {create} = props
  const createRef = useRef(create)

  const {layer, visible} = useTileLayer()
  const map = useMap()

  useEffect(() => {
    if (!visible) { return }

    const backingLayer = createRef.current(layer.name)
    return map.ensureBackingLayer(layer.name, backingLayer)
  }, [create, layer.name, map, visible])

  return null

})