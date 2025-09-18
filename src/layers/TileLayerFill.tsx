import { FillLayerSpecification } from '@maptiler/sdk'
import { useEffect, useRef } from 'react'
import { memo } from 'react-util'
import { usePrevious, useWithStableDeps } from 'react-util/hooks'
import { useMap } from '../MapContext'
import { useLayerGroup } from './LayerGroupContext'
import { useTileLayer } from './TileLayerContext'
import { TileLayerCommonProps } from './types'

export type TileLayerFillProps = TileLayerCommonProps & Omit<FillLayerSpecification, 'id' | 'type' | 'source' | 'source-layer'>

export const TileLayerFill = memo('TileLayerFill', (props: TileLayerFillProps) => {

  const {
    onClick,
    source,
    sourceLayer,
    paint,
    ...rest
  } = props

  const layer = useTileLayer()
  const group = useLayerGroup()

  const {ensureBackingLayer, updateBackingLayerPaint, addTileBackingLayerClickListener} = useMap()

  const id = `${layer.name}:fill`
  const initialPaintRef = useRef(paint)
  const prevPaint = usePrevious(paint)

  useEffect(() => {
    if (onClick == null) { return }
    return addTileBackingLayerClickListener(id, onClick)
  }, [addTileBackingLayerClickListener, id, onClick])

  const stableRest = useWithStableDeps(rest, () => [])
  useEffect(() => {
    return ensureBackingLayer(layer.name, {
      id:             id,
      type:           'fill',
      source:         source ?? layer.name,
      'source-layer': sourceLayer ?? layer.name,
      paint:          initialPaintRef.current,   
      ...stableRest,
    }, {
      group: group?.name,
    })
  }, [ensureBackingLayer, group?.name, id, layer.name, source, sourceLayer, stableRest])

  useEffect(() => {
    if (prevPaint === undefined) { return }
    if (paint === prevPaint) { return }
    updateBackingLayerPaint(id, paint)
  }, [id, paint, prevPaint, updateBackingLayerPaint])

  return null

})