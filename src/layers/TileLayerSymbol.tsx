import { SymbolLayerSpecification } from '@maptiler/sdk'
import { useEffect, useRef } from 'react'
import { memo } from 'react-util'
import { usePrevious, useWithStableDeps } from 'react-util/hooks'
import { sparse } from 'ytil'
import { useMap } from '../MapContext'
import { useLayerGroup } from './LayerGroupContext'
import { useTileLayer } from './TileLayerContext'
import { TileLayerCommonProps } from './types'

export type TileLayerSymbolProps = TileLayerCommonProps & Omit<SymbolLayerSpecification, 'id' | 'type' | 'source' | 'source-layer'>

export const TileLayerSymbol = memo('TileLayerSymbol', (props: TileLayerSymbolProps) => {

  const {
    source,
    sourceLayer,
    onClick,
    paint,
    ...rest
  } = props

  const layer = useTileLayer()
  const group = useLayerGroup()

  const {ensureBackingLayer, updateBackingLayerPaint, addTileBackingLayerClickListener} = useMap()

  const id = `${layer.name}:symbol`
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
      type:           'symbol',
      source:         sparse([source, layer.name]).join('-'),
      'source-layer': sourceLayer ?? layer.name,
      paint:          initialPaintRef.current, 
      ...stableRest,
    }, {
      group: group?.name,
    })
  }, [ensureBackingLayer, group, id, layer.name, source, sourceLayer, stableRest])

  useEffect(() => {
    if (prevPaint === undefined) { return }
    if (paint === prevPaint) { return }

    updateBackingLayerPaint(id, paint)
  }, [id, paint, prevPaint, updateBackingLayerPaint])

  return null

})