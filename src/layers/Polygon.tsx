import { PaletteRange, useTheme } from '@mui/joy'
import { Geometry } from 'geojson-classes'
import { useEffect, useMemo } from 'react'
import { memo } from 'react-util'
import { useMap } from '../MapContext'

interface PolygonProps {
  id:       string
  geometry: Geometry

  color?:       string
  fillOpacity?: number
  lineOpacity?: number
  selected?:    boolean

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
    lineOpacity = 0.9,
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

  useEffect(() => {
    if (onClick == null) { return }
    return addPolygonClickListener(id, onClick)
  }, [addPolygonClickListener, id, onClick])

  useEffect(() => {
    return addPolygon(id, {geometry, color, lineOpacity, fillOpacity}, {
      group,
    })
  }, [addPolygon, color, fillOpacity, geometry, id, group, lineOpacity, onClick])

  return null

})