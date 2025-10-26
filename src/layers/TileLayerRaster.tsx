import { RasterLayerSpecification } from '@maptiler/sdk'
import { kebabCase, mapKeys } from 'lodash'
import { useEffect, useMemo } from 'react'
import { memo } from 'react-util'
import { useWithStableDeps } from 'react-util/hooks'
import { CamelizeKeys, omitUndefined, sparse } from 'ytil'
import { useMap } from '../MapContext'
import { useLayerGroup } from './LayerGroupContext'
import { useTileLayer } from './TileLayerContext'
import { TileLayerCommonProps } from './types'

type TileLayerRasterBaseProps = CamelizeKeys<Omit<RasterLayerSpecification, 'id' | 'type' | 'source' | 'source-layer'>>

export interface TileLayerRasterProps extends TileLayerCommonProps, TileLayerRasterBaseProps {
  name?: string

  source?:      string
  sourceLayer?: string
}

export const TileLayerRaster = memo('TileLayerRaster', (props: TileLayerRasterProps) => {

  const {
    source,
    sourceLayer,
    ...rest
  } = props

  const layer = useTileLayer()
  const group = useLayerGroup()

  const map = useMap()

  // Create an ID based on the sourceLayer 
  const id = sparse([layer.name, props.sourceLayer]).join('-')

  // All rest props are considered part of the layer spec. Make sure to use a `key` prop if you have a dynamic
  // layer specification.
  const spec = useWithStableDeps(rest, () => [])

  const backingLayer = useMemo(() => {
    return omitUndefined({
      id,

      type:     'raster',
      tileSize: 256,

      source:         sparse([layer.name, source]).join('-'),
      'source-layer': sourceLayer,

      ...mapKeys(spec, (_, key) => kebabCase(key)) as any,
    })
  }, [id, layer.name, source, sourceLayer, spec])

  useEffect(() => {
    return map.addTileLayerBackingLayer(backingLayer, {
      group: group?.name,
    })
  }, [backingLayer, group?.name, map])

  return null

})