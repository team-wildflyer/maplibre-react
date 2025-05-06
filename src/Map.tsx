import { FitBoundsOptions, MapOptions } from '@maptiler/sdk'
import { useMap } from 'maplibre-react'
import React, { Ref, useEffect, useImperativeHandle, useRef } from 'react'
import { useSize } from 'react-measure'
import { forwardRef } from 'react-util'
import './Map.css'
import { defaultStyle } from './MapModel'
import { Viewport } from './Viewport'
import { FitBoundsOptionsCallback, MapStyleSpecification } from './types'

export interface MapProps {
  /**
   * The map style. The default is `MapStyle.DATAVIZ.DEFAULT`.
   */
  style: MapStyleSpecification
  
  /**
   * The default viewport of the map. This is used to set the initial bounds of the map, and is also used when
   * `resetViewport` is called.
   */
  defaultViewport?: Viewport

  /**
   * Provides options for the `fitBounds` method, whenever the map is resized, the viewport is reset, or the
   * default viewport is changed.
   * 
   * @param reason The reason why `fitBounds` is called.
   * @param from The previous bounds BBox of the map.
   * @param to The new bounds BBox of the map.
   * @returns
   *   Return `false` to disable animating. Return `true` for a default animation. Return an object to
   *   customize the animation.
   */
  fitBoundsOptions?: FitBoundsOptionsCallback

  labelsVisible?: boolean

  /**
   * Any options passed to the map. Note that this is not reactive. These options are set once.
   */
  options?:  Omit<MapOptions, 'container' | 'bounds' | 'style' | 'center' | 'zoom'>
  children?: React.ReactNode
}

export interface MapHandle {
  resetViewport:           () => void
  setNextFitBoundsOptions: (value: boolean | FitBoundsOptions) => void
}

export const Map = forwardRef('Map', (props: MapProps, ref: Ref<MapHandle>) => {

  const {
    style = defaultStyle(),
    defaultViewport,
    fitBoundsOptions,
    labelsVisible,
    children,
    options = {},
  } = props

  const map = useMap()

  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const styleRef = useRef(style)
  const defaultViewportRef = useRef(defaultViewport)
  const labelsVisibleRef = useRef(labelsVisible)

  // #region Initialization

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (wrapper == null) {
      return map.disconnect()
    }

    // Set these immediately so the map won't flicker. They are updated in a separate effect below.
    map.setStyle(styleRef.current)
    if (defaultViewportRef.current != null) {
      map.setDefaultViewport(defaultViewportRef.current)
    }
    if (labelsVisibleRef.current != null) {
      map.setLabelsVisible(labelsVisibleRef.current)
    }

    map.connect(wrapper, options)
  }, [map, options])

  // #endregion

  // #region Prop updates

  useEffect(() => {
    if (style === styleRef.current) { return }
    styleRef.current = style
    map.setStyle(styleRef.current)
  }, [map, style])

  useEffect(() => {
    if (defaultViewport === defaultViewportRef.current) { return }
    defaultViewportRef.current = defaultViewport
    if (defaultViewportRef.current != null) {
      map.setDefaultViewport(defaultViewportRef.current)
    } else {
      map.resetDefaultViewport()
    }
  }, [map, defaultViewport])

  useEffect(() => {
    if (fitBoundsOptions == null) { return }
    map.setFitBoundsOptionsCallback(fitBoundsOptions)
  }, [fitBoundsOptions, map])

  useEffect(() => {
    if (labelsVisible == null) { return }
    if (labelsVisible === labelsVisibleRef.current) { return }
    labelsVisibleRef.current = labelsVisible
    map.setLabelsVisible(labelsVisibleRef.current)
  }, [labelsVisible, map])

  // #endregion

  // #region Imperative handle

  useImperativeHandle(ref, () => ({
    resetViewport:           map.resetViewport,
    setNextFitBoundsOptions: map.setNextFitBoundsOptions,
  }))

  // #endregion
  
  const size = useSize(containerRef)

  function render() {
    return (
      <div className='maplibre-react--Map' ref={containerRef}>
        {size.width > 0 && (
          <div
            className='maplibre-react--Map-Wrapper'
            style={{...size}}
            ref={wrapperRef}
          />
        )}
        {children}
      </div>
    )
  }

  return render()

})