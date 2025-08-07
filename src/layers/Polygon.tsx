import { PaletteRange, useTheme } from '@mui/joy'
import { Geometry } from 'geojson-classes'
import { useEffect, useMemo } from 'react'
import { memo } from 'react-util'
import { useMap } from '../MapContext'
import { LineStyle } from '../types'

interface PolygonProps {
  id:       string
  geometry: Geometry

  color?:       string
  fillOpacity?: number
  selected?:    boolean

  lineColor?:   string
  lineOpacity?: number
  lineStyle?:   LineStyle
  lineWidth?:   number

  group?:   string
  onClick?: () => void
}

export const Polygon = memo('Polygon', (props: PolygonProps) => {

  const {
    id,
    geometry,
    color: props_color = 'primary',
    selected,
    fillOpacity = selected ? 0.9 : 0.6,

    lineColor: props_line_color = 'primary',
    lineOpacity = 0.9,
    lineStyle = LineStyle.Solid,
    lineWidth = 1,
    
    group,
    onClick,
  } = props

  const {addPolygon, addPolygonClickListener} = useMap()
  const theme = useTheme()

  const color = useMemo(() => {
    if (props_color == null) { return undefined }
    if (props_color in theme.palette) {
      const palette = theme.palette[props_color as keyof typeof theme.palette] as PaletteRange
      return palette['500']
    } else {
      return props_color
    }
  }, [props_color, theme])

  const lineColor = useMemo(() => {
    if (props_line_color == null) { return undefined }
    if (props_line_color in theme.palette) {
      const palette = theme.palette[props_line_color as keyof typeof theme.palette] as PaletteRange
      return palette['500']
    } else {
      return props_line_color
    }
  }, [props_line_color, theme])

  useEffect(() => {
    if (onClick == null) { return }
    console.log('should add listeners for polygon click', id)
    return addPolygonClickListener(id, onClick)
  }, [addPolygonClickListener, id, onClick])

  useEffect(() => {
    return addPolygon(id, {geometry, color, lineOpacity, fillOpacity, lineStyle, lineWidth, lineColor}, {
      group,
    })
  }, [addPolygon, color, fillOpacity, geometry, id, group, lineOpacity, lineStyle, lineWidth, lineColor, onClick])

  return null

})