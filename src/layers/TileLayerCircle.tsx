import { CircleLayerSpecification } from '@maptiler/sdk'
import { useEffect, useMemo, useRef } from 'react'
import { memo } from 'react-util'
import { usePrevious, useWithStableDeps } from 'react-util/hooks'
import { sparse } from 'ytil'
import { useMap } from '../MapContext'
import { useLayerGroup } from './LayerGroupContext'
import { useTileLayer } from './TileLayerContext'
import { TileLayerCommonProps } from './types'

export type TileLayerCircleProps = TileLayerCommonProps & Omit<CircleLayerSpecification, 'id' | 'type' | 'source' | 'source-layer'>

export const TileLayerCircle = memo('TileLayerCircle', (props: TileLayerCircleProps) => {

  const {
    source,
    sourceLayer,
    onClick,
    layout,
    paint,
    ...rest
  } = props

  const layer = useTileLayer()
  const group = useLayerGroup()

  const {
    addTileLayerBackingLayer: ensureBackingLayer, 
    updateBackingLayerPaint, 
    updateBackingLayerLayout, 
    addTileBackingLayerClickListener,
  } = useMap()

  const id = `${sparse([layer.name, props.sourceLayer]).join('-')}:circle`

  const initialLayoutRef = useRef(layout)
  const prevLayout = usePrevious(layout)

  const initialPaintRef = useRef(paint)
  const prevPaint = usePrevious(paint)

  useEffect(() => {
    if (onClick == null) { return }
    return addTileBackingLayerClickListener(id, onClick)
  }, [addTileBackingLayerClickListener, id, onClick])

  const spec = useWithStableDeps(rest, () => [])
  const backingLayer = useMemo((): CircleLayerSpecification => {
    return {
      id:             id,
      type:           'circle',
      source:         sparse([source, layer.name]).join('-'),
      'source-layer': sourceLayer ?? layer.name,
      layout:         initialLayoutRef.current,
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
    if (prevLayout === undefined) { return }
    if (layout === prevLayout) { return }

    updateBackingLayerLayout(id, layout)
  }, [id, layout, prevLayout, updateBackingLayerLayout])

  useEffect(() => {
    if (prevPaint === undefined) { return }
    if (paint === prevPaint) { return }

    updateBackingLayerPaint(id, paint)
  }, [id, paint, prevPaint, updateBackingLayerPaint])

  return null

})