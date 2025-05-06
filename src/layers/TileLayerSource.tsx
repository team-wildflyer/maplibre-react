import { RasterSourceSpecification, VectorSourceSpecification } from '@maptiler/sdk'
import { useEffect } from 'react'
import { memo } from 'react-util'
import { useWithStableDeps } from 'react-util/hooks'
import { CamelizeKeys, sparse } from 'ytil'
import { useMap } from '~/ui/hooks'
import { useTileLayer } from './TileLayerContext'

export type TileLayerSourceProps = CamelizeKeys<Omit<VectorSourceSpecification | RasterSourceSpecification, 'tiles'>> & {
  name?: string
  url:   string
}

export const TileLayerSource = memo('TileLayerSource', (props: TileLayerSourceProps) => {

  const {layer} = useTileLayer()

  const {
    name,
    url,
    ...rest
  } = props

  const map = useMap()
  const spec = useWithStableDeps(rest, () => [])
  const id = sparse([layer.name, name]).join('-')

  useEffect(() => {
    // Add the source regardless of whether it's visible or not.
    map.ensureTileLayerSource(id, url, spec)
  }, [id, layer.name, map, name, spec, url])

  useEffect(() => () => {
    map.removeSource(id)
  }, [id, map])

  return null

})
