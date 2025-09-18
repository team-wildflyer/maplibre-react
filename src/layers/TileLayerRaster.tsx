import { RasterLayerSpecification } from '@maptiler/sdk'
import { kebabCase, mapKeys } from 'lodash'
import { useEffect, useMemo } from 'react'
import { memo } from 'react-util'
import { useWithStableDeps } from 'react-util/hooks'
import { CamelizeKeys, sparse } from 'ytil'
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

  const layer = useTileLayer()
  const group = useLayerGroup()

  const map = useMap()
  const spec = useWithStableDeps(props, () => [])

  const backingLayer = useMemo(
    () => buildRasterLayerSpec(layer.name, spec),
    [layer.name, spec]
  )

  useEffect(() => {
    return map.ensureBackingLayer(layer.name, backingLayer, {
      group: group?.name,
    })
  }, [backingLayer, group, layer.name, map, spec])

  return null

})

function buildRasterLayerSpec(namespace: string, props: TileLayerRasterProps): RasterLayerSpecification {
  const spec = mapKeys(props, (_, key) => kebabCase(key)) as any
  const id = sparse([namespace, props.name ?? spec['source-layer']]).join('-')

  return {
    id,
    type:           'raster',
    source:         namespace,
    'source-layer': namespace,
    ...spec,
  }
}
