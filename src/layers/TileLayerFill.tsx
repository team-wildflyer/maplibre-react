import {
  ColorSpecification,
  ExpressionSpecification,
  FillLayerSpecification,
  MapGeoJSONFeature,
  MapMouseEvent,
} from '@maptiler/sdk'
import { useEffect, useMemo, useRef } from 'react'
import { memo } from 'react-util'
import { usePrevious } from 'react-util/hooks'
import { omitUndefined } from 'ytil'
import { useMap } from '~/ui/hooks'
import { useTileLayer } from './TileLayerContext'

export interface TileLayerFillProps extends TileLayerFillPaintSpecification {
  source?:      string
  sourceLayer?: string

  group?:   string
  onClick?: (event: MapMouseEvent, feature?: MapGeoJSONFeature) => void
}

export interface TileLayerFillPaintSpecification {
  fillColor?:   ColorSpecification | ExpressionSpecification
  fillOpacity?: number | ExpressionSpecification
}

export const TileLayerFill = memo('TileLayerFill', (props: TileLayerFillProps) => {

  const {
    group, 
    onClick,
    source,
    sourceLayer,
    fillColor, 
    fillOpacity, 
  } = props
  const {layer, visible} = useTileLayer()

  const {ensureBackingLayer, updateBackingLayerPaint, addTileBackingLayerClickListener} = useMap()
  const paint = useMemo((): FillLayerSpecification['paint'] => omitUndefined({
    'fill-color':     fillColor,
    'fill-opacity':   fillOpacity,
    'fill-antialias': true,
  }), [fillColor, fillOpacity])

  const id = `${layer.name}:fill`
  const initialPaintRef = useRef(paint)
  const prevPaint = usePrevious(paint)

  useEffect(() => {
    if (!visible || onClick == null) { return }
    return addTileBackingLayerClickListener(id, onClick)
  }, [addTileBackingLayerClickListener, id, onClick, visible])

  useEffect(() => {
    if (!visible) { return }

    return ensureBackingLayer(layer.name, {
      id:             id,
      type:           'fill',
      source:         source ?? layer.name,
      'source-layer': sourceLayer ?? layer.name,
      paint:          initialPaintRef.current,   
    }, {
      group,
    })
  }, [ensureBackingLayer, group, id, layer.name, source, sourceLayer, visible])

  useEffect(() => {
    if (prevPaint === undefined) { return }
    if (paint === prevPaint) { return }
    updateBackingLayerPaint(id, paint)
  }, [id, paint, prevPaint, updateBackingLayerPaint])

  return null

})