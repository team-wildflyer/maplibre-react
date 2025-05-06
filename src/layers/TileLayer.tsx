import { DateTime } from 'luxon'
import { useContext, useEffect, useMemo } from 'react'
import { BackingLayerControl } from '~/stores'
import { IconProp } from '~/ui/components'
import { useMap } from '~/ui/hooks'
import { observer } from '~/util/observer'
import { LayerCategoryContext } from './LayerCategory'
import { TileLayerContext } from './TileLayerContext'
import { TileLayerCustom } from './TileLayerCustom'
import { TileLayerFeatureState } from './TileLayerFeatureState'
import { TileLayerFill } from './TileLayerFill'
import { TileLayerLine } from './TileLayerLine'
import { TileLayerRaster } from './TileLayerRaster'
import { TileLayerSource } from './TileLayerSource'

export interface TileLayerProps {
  name: string

  label:     string
  subtitle?: string
  icon?:     IconProp
  image?:    string

  visible?: TileLayerVisibility
  setTime?: (name: string, time: DateTime) => void

  children?: React.ReactNode
}

export type TileLayerVisibility =
  | 'always' // Always visible - hidden in menu.
  | 'never' // Never visible - hidden in menu.
  | 'toggleable' // Shows in the menu.

const _TileLayer = observer('TileLayer', (props: TileLayerProps) => {

  const map = useMap()

  const {
    name,
    label,
    subtitle,
    icon,
    image,
    visible: props_visible = 'toggleable',
    setTime,
    children,
  } = props

  const visible = props_visible === 'toggleable' ? map.isLayerVisible(name) : props_visible === 'always'
  const category = useContext(LayerCategoryContext)

  const context = useMemo((): TileLayerContext => ({
    layer: {
      name,
      label,
      subtitle,
      icon,
      image,
    },
    visible,
  }), [icon, image, label, name, subtitle, visible])

  const control = useMemo((): BackingLayerControl => ({
    setTime,
  }), [setTime])

  useEffect(() => {
    map.registerLayer(context.layer, {
      showInMenu: props_visible === 'toggleable',
      category:   category?.name,
      control,
    })
  }, [category?.name, context.layer, control, map, props_visible])

  useEffect(() => () => {
    map.removeLayer(context.layer.name)
  }, [context.layer.name, map])

  return (
    <TileLayerContext.Provider value={context}>
      {children}
    </TileLayerContext.Provider>
  )

})

Object.assign(_TileLayer, {
  Source:       TileLayerSource,
  Fill:         TileLayerFill,
  Line:         TileLayerLine,
  Raster:       TileLayerRaster,
  Custom:       TileLayerCustom,
  FeatureState: TileLayerFeatureState,
})

export const TileLayer = _TileLayer as typeof _TileLayer & {
  Source:       typeof TileLayerSource
  Fill:         typeof TileLayerFill
  Line:         typeof TileLayerLine
  Raster:       typeof TileLayerRaster
  Custom:       typeof TileLayerCustom
  FeatureState: typeof TileLayerFeatureState
}