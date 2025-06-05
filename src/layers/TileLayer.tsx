import React, { useMemo } from 'react'
import { memo } from 'react-util'
import { TileLayerContext } from './TileLayerContext'
import { TileLayerCustom } from './TileLayerCustom'
import { TileLayerFeatureState } from './TileLayerFeatureState'
import { TileLayerFill } from './TileLayerFill'
import { TileLayerLine } from './TileLayerLine'
import { TileLayerRaster } from './TileLayerRaster'
import { TileLayerSource } from './TileLayerSource'

export interface TileLayerProps {
  name:      string
  children?: React.ReactNode
}

const TileLayer$ = memo('TileLayer', (props: TileLayerProps) => {

  const {
    name,
    children,
  } = props
  
  const context = useMemo((): TileLayerContext => ({
    name,
  }), [name])

  return (
    <TileLayerContext.Provider value={context}>
      {children}
    </TileLayerContext.Provider>
  )

})

Object.assign(TileLayer$, {
  Source:       TileLayerSource,
  Fill:         TileLayerFill,
  Line:         TileLayerLine,
  Raster:       TileLayerRaster,
  Custom:       TileLayerCustom,
  FeatureState: TileLayerFeatureState,
})

export const TileLayer = TileLayer$ as typeof TileLayer$ & {
  Source:       typeof TileLayerSource
  Fill:         typeof TileLayerFill
  Line:         typeof TileLayerLine
  Raster:       typeof TileLayerRaster
  Custom:       typeof TileLayerCustom
  FeatureState: typeof TileLayerFeatureState
}