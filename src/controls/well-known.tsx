import { IControl } from '@maptiler/sdk'
import {
  AttributionControl as ml_AttributionControl,
  FullscreenControl as ml_FullscreenControl,
  GeolocateControl as ml_GeolocateControl,
  NavigationControl as ml_NavigationControl,
  ScaleControl as ml_ScaleControl,
  ScaleControlOptions,
  TerrainControl as ml_TerrainControl,
} from '@maptiler/sdk'
import React, { ComponentType, useEffect, useMemo, useRef } from 'react'
import { memo } from 'react-util'
import { Constructor } from 'ytil'
import { useMap } from '../MapContext'
import { ControlNameKey } from '../symbols'
import { Control } from './Control'

export const AttributionControl = createWellKnownControl('AttributionControl', ml_AttributionControl)
export const FullscreenControl = createWellKnownControl('FullscreenControl', ml_FullscreenControl)
export const GeolocateControl = createWellKnownControl('GeolocateControl', ml_GeolocateControl)
export const NavigationControl = createWellKnownControl('NavigationControl', ml_NavigationControl)
export const ScaleControl = createWellKnownControl<ScaleControlOptions>('ScaleControl', ml_ScaleControl)
export const TerrainControl = createWellKnownControl('TerrainControl', ml_TerrainControl)

function createWellKnownControl<P>(name: string, ControlClass: Constructor<IControl, [P]>): ComponentType<P> {
  return memo(name, (props: P) => {

    const {...options} = props

    const map = useMap()

    const ref = useRef<HTMLDivElement>(null)
    const control = useMemo(() => {
      const control = new ControlClass(options)
      Object.assign(control, {
        [ControlNameKey]: name,
      })
      return control
    }, [options])

    useEffect(() => {
      const container = ref.current
      if (container == null) { return }

      return map.registerChildControl(control, container)
    }, [control, map])

    return <Control ref={ref}/>

  })
}