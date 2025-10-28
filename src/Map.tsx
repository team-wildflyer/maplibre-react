import { FitBoundsOptions, MapOptions } from '@maptiler/sdk'
import cn from 'classnames'
import {
  CSSProperties,
  ReactNode,
  Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSize } from 'react-measure'
import { useTimer } from 'react-timer'
import { forwardRef } from 'react-util'
import { useMap } from './MapContext'
import { Viewport } from './Viewport'
import config from './config'
import { useMapReady } from './hooks'
import './styles.css'
import { FitBoundsOptionsCallback, MapStyleSpecification } from './types'

export interface MapProps {
  /**
   * The map style. The default is `MapStyle.DATAVIZ.DEFAULT`.
   */
  mapStyle: MapStyleSpecification
  
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
   * Hides the map element (visibility: hidden) until its first `idle` event.
   */
  hideUntilReady?: boolean

  /**
   * If the map is hidden because it's not ready, this element is shown instead. Ignored if `hideUntilReady` is set
   * to `false.
   */
  renderReadyGuard?: () => ReactNode

  /**
   * Any options passed to the map. Note that this is not reactive. These options are set once.
   */
  options?: Omit<MapOptions, 'container' | 'bounds' | 'style' | 'center' | 'zoom'>

  className?: string
  style?:     CSSProperties

  children?: ReactNode
}

export interface MapHandle {
  resetViewport:           () => void
  setNextFitBoundsOptions: (value: boolean | FitBoundsOptions) => void
}

export const Map = forwardRef('Map', (props: MapProps, ref: Ref<MapHandle>) => {

  const {
    mapStyle = config.defaultStyle,
    defaultViewport,
    fitBoundsOptions,
    labelsVisible = true,
    hideUntilReady = true,
    renderReadyGuard,
    options = {},
    className,
    style,
    children,
  } = props

  const map = useMap()
  const ready = useMapReady()

  const containerRef = useRef<HTMLDivElement>(null)
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)

  const mapStyleRef = useRef(mapStyle)
  const defaultViewportRef = useRef(defaultViewport)
  const labelsVisibleRef = useRef(labelsVisible)

  // #region Initialization

  const initTimer = useTimer()

  useEffect(() => {
    if (wrapper == null) { return }
    if (wrapper.clientWidth === 0 || wrapper.clientHeight === 0) { return }

    // This prevents a possible "Style not loaded" error when loading the map. This is fully internal,
    // and in some async code, preventing me from catching the error synchronously. I hate to resort
    // to something like this, but MapLibre is sometimes just a bit shaky.
    initTimer.setTimeout(() => {
      map.init(
        wrapper,
        mapStyleRef.current,
        defaultViewportRef.current,
        options,
      )
    }, 0)
    return () => { map.deinit() }
  }, [initTimer, map, options, wrapper])

  // #endregion

  // #region Prop updates

  useEffect(() => {
    if (mapStyle === mapStyleRef.current) { return }

    mapStyleRef.current = mapStyle
    map.setMapStyle(mapStyleRef.current)
  }, [map, mapStyle])

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
    if (labelsVisible === labelsVisibleRef.current) { return }
    labelsVisibleRef.current = labelsVisible
    map.setLabelsVisible(labelsVisibleRef.current)
  }, [labelsVisible, map])

  useEffect(() => {
    if (fitBoundsOptions == null) { return }
    map.setFitBoundsOptionsCallback(fitBoundsOptions)
  }, [fitBoundsOptions, map])

  // #endregion

  // #region Imperative handle

  useImperativeHandle(ref, () => ({
    resetViewport:           map.resetViewport,
    setNextFitBoundsOptions: map.setNextFitBoundsOptions,
  }))

  // #endregion
  
  const size = useSize(containerRef)
  const wrapperStyle = useMemo(() => {
    return {
      ...size,
      visbility: !ready && hideUntilReady ? 'hidden' : undefined,
    }
  }, [hideUntilReady, ready, size])

  function render() {
    return (
      <div className={cn('maplibre-react--Map', className)} style={style} ref={containerRef}>
        {size.width > 0 && (
          <div
            className='maplibre-react--Map-Wrapper'
            style={wrapperStyle}
            ref={setWrapper}
          />
        )}
        {!ready && hideUntilReady && renderReadyGuard?.()}
        {children}
      </div>
    )
  }

  return render()

})