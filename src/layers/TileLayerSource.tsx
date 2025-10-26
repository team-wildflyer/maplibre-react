import { RasterSourceSpecification, VectorSourceSpecification } from '@maptiler/sdk'
import { useEffect, useMemo } from 'react'
import { memo } from 'react-util'
import { useWithStableDeps } from 'react-util/hooks'
import { CamelizeKeys, sparse } from 'ytil'
import { useMap } from '../MapContext'
import { useTileLayer } from './TileLayerContext'

export type TileLayerSourceProps = (CamelizeKeys<Omit<VectorSourceSpecification, 'tiles'>> | CamelizeKeys<Omit<RasterSourceSpecification, 'tiles'>>) & {
  id?:   string
  name?: string
  url:   string
}

export const TileLayerSource = memo('TileLayerSource', (props: TileLayerSourceProps) => {

  const layer = useTileLayer()

  const {
    id: props_id,
    name,
    url,
    ...rest
  } = props

  const map = useMap()
  const spec = useWithStableDeps(rest, () => [])
  const id = useMemo(
    () => props_id ?? sparse([layer.name, name]).join('-'),
    [layer.name, name, props_id]
  )

  useEffect(() => {
    // Add the source regardless of whether it's visible or not.
    map.ensureTileLayerSource(id, url, spec)
  }, [id, map, spec, url])

  useEffect(() => () => {
    map.removeSource(id)
  }, [id, map])

  return null

})
