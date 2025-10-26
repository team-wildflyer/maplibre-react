import { FillLayerSpecification } from '@maptiler/sdk'
import { useEffect, useMemo, useRef } from 'react'
import { memo } from 'react-util'
import { usePrevious, useWithStableDeps } from 'react-util/hooks'
import { sparse } from 'ytil'
import { useMap } from '../MapContext'
import { useLayerGroup } from './LayerGroupContext'
import { useTileLayer } from './TileLayerContext'
import { TileLayerCommonProps } from './types'

export type TileLayerFillProps = TileLayerCommonProps & Omit<FillLayerSpecification, 'id' | 'type' | 'source' | 'source-layer'>

export const TileLayerFill = memo('TileLayerFill', (props: TileLayerFillProps) => {

  const {
    source,
    sourceLayer,
    onClick,
    paint,
    ...rest
  } = props

  const layer = useTileLayer()
  const group = useLayerGroup()

  const {addTileLayerBackingLayer: ensureBackingLayer, updateBackingLayerPaint, addTileBackingLayerClickListener} = useMap()

  const id = `${sparse([layer.name, props.sourceLayer]).join('-')}:fill`
  const initialPaintRef = useRef(paint)
  const prevPaint = usePrevious(paint)

  useEffect(() => {
    if (onClick == null) { return }
    return addTileBackingLayerClickListener(id, onClick)
  }, [addTileBackingLayerClickListener, id, onClick])

  const spec = useWithStableDeps(rest, () => [])
  const backingLayer = useMemo((): FillLayerSpecification => {
    return {
      id:             id,
      type:           'fill',
      source:         sparse([source, layer.name]).join('-'),
      'source-layer': sourceLayer ?? layer.name,
      paint:          initialPaintRef.current, 
      ...spec,
    }
  }, [id, layer.name, source, sourceLayer, spec])

  useEffect(() => {
    return ensureBackingLayer(backingLayer, {
      group: group?.name,
    })
  }, [backingLayer, ensureBackingLayer, group?.name])

  useEffect(() => {
    if (prevPaint === undefined) { return }
    if (paint === prevPaint) { return }

    updateBackingLayerPaint(id, paint)
  }, [id, paint, prevPaint, updateBackingLayerPaint])

  return null

})