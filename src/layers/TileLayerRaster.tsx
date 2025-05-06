import { RasterLayerSpecification } from '@maptiler/sdk'
import { kebabCase, mapKeys } from 'lodash'
import { useEffect, useMemo } from 'react'
import { memo } from 'react-util'
import { useWithStableDeps } from 'react-util/hooks'
import { CamelizeKeys, sparse } from 'ytil'
import { useMap } from '~/ui/hooks'
import { useTileLayer } from './TileLayerContext'

type TileLayerRasterBaseProps = CamelizeKeys<Omit<RasterLayerSpecification, 'id' | 'type' | 'source' | 'source-layer'>>

export interface TileLayerRasterProps extends TileLayerRasterBaseProps {
  name?: string

  source?:      string
  sourceLayer?: string

  group?: string
}

export const TileLayerRaster = memo('TileLayerRaster', (props: TileLayerRasterProps) => {

  const {group, ...rest} = props
  const {layer, visible} = useTileLayer()

  const map = useMap()
  const spec = useWithStableDeps(rest, () => [])

  const backingLayer = useMemo(
    () => buildRasterLayerSpec(layer.name, spec),
    [layer.name, spec]
  )

  useEffect(() => {
    if (!visible) { return }

    return map.ensureBackingLayer(layer.name, backingLayer, {group})
  }, [backingLayer, group, layer.name, map, spec, visible])

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
