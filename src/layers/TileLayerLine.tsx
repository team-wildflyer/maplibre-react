import {
  ColorSpecification,
  ExpressionSpecification,
  LineLayerSpecification,
  MapGeoJSONFeature,
  MapMouseEvent,
} from '@maptiler/sdk'
import { useEffect, useMemo, useRef } from 'react'
import { memo } from 'react-util'
import { usePrevious } from 'react-util/hooks'
import { omitUndefined } from 'ytil'
import { useMap } from '../MapContext'
import { useLayerGroup } from './LayerGroupContext'
import { useTileLayer } from './TileLayerContext'

export interface TileLayerLineProps extends TileLayerLinePaintSpecification {
  source?:      string
  sourceLayer?: string

  onClick?: (event: MapMouseEvent, feature?: MapGeoJSONFeature) => void
}

export interface TileLayerLinePaintSpecification {
  lineColor?:   ColorSpecification | ExpressionSpecification
  lineWidth?:   number | ExpressionSpecification
  lineOpacity?: number | ExpressionSpecification
}

export const TileLayerLine = memo('TileLayerLine', (props: TileLayerLineProps) => {

  const {
    source,
    sourceLayer,
    onClick,
    lineColor, 
    lineOpacity, 
    lineWidth,
  } = props

  const layer = useTileLayer()
  const group = useLayerGroup()

  const {ensureBackingLayer, updateBackingLayerPaint, addTileBackingLayerClickListener} = useMap()
  const paint = useMemo((): LineLayerSpecification['paint'] => omitUndefined({
    'line-color':   lineColor,
    'line-opacity': lineOpacity,
    'line-width':   lineWidth,
  }), [lineColor, lineOpacity, lineWidth])

  const id = `${layer.name}:line`
  const initialPaintRef = useRef(paint)
  const prevPaint = usePrevious(paint)

  useEffect(() => {
    if (onClick == null) { return }
    return addTileBackingLayerClickListener(id, onClick)
  }, [addTileBackingLayerClickListener, id, onClick])

  useEffect(() => {
    return ensureBackingLayer(layer.name, {
      id:             id,
      type:           'line',
      source:         source ?? layer.name,
      'source-layer': sourceLayer ?? layer.name,
      paint:          initialPaintRef.current, 
    }, {
      group: group?.name,
    })
  }, [ensureBackingLayer, group, id, layer.name, source, sourceLayer])

  useEffect(() => {
    if (prevPaint === undefined) { return }
    if (paint === prevPaint) { return }

    updateBackingLayerPaint(id, paint)
  }, [id, paint, prevPaint, updateBackingLayerPaint])

  return null

})