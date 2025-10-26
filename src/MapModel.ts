import {
  ControlPosition,
  FeatureIdentifier,
  FitBoundsOptions,
  IControl,
  LayerSpecification,
  LngLatBounds,
  Map as maptiler_Map,
  MapEventType,
  MapGeoJSONFeature,
  MapLayerEventType,
  MapLayerMouseEvent,
  MapLibreEvent,
  MapMouseEvent,
  MapOptions as maptiler_MapOptions,
  Marker,
  MarkerOptions,
  RasterSourceSpecification,
  SourceSpecification,
  VectorSourceSpecification,
} from '@maptiler/sdk'
import { Point } from 'geojson'
import { BBox, Geometry } from 'geojson-classes'
import { isFunction } from 'lodash'
import Timer from 'react-timer'
import { Disposable } from 'react-util'
import { bindMethods, objectEquals, objectKeys } from 'ytil'
import { MapLayersOrdering } from './MapLayersOrdering'
import { OperationQueue, queueUntil } from './OperationQueue'
import { Viewport, ViewportLike } from './Viewport'
import config from './config'
import {
  BackingLayer,
  FitBoundsOptionsCallback,
  FitBoundsReason,
  LayerGroupOrdering,
  LineStyle,
  MapBoxDrawEventType,
  MapStatus,
  MapStyleSpecification,
  PolygonConfig,
} from './types'

export class MapModel extends Disposable {

  constructor() {
    super()
    bindMethods(this)

    this.disposer(() => {
      this.layerTimer.clearAll()
      this.markerTimer.clearAll()
      this.polygonTimer.clearAll()
    })
  }

  public readonly operationQueue = new OperationQueue(this)

  // #region Map & initialization

  private _loaded: boolean = false
  public get loaded() { return this._loaded }
  
  private _idle: boolean = false
  public get idle() { return this._idle }

  private _initializationErrors: Error[] = []
  public get initializationErrors() { return this._initializationErrors }

  public get status(): MapStatus {
    if (this.initializationErrors.length > 0) {
      return MapStatus.Error
    } else if (this.idle) {
      return MapStatus.Idle
    } else if (this.loaded) {
      return MapStatus.Loaded
    } else {
      return MapStatus.Uninitialized
    }
  }

  private _element: HTMLElement | null = null
  public get element() { return this._element }

  private _map: maptiler_Map | null = null
  public get map() { return this._map }

  public get size() {
    return {
      width:  this._element?.clientWidth ?? 0,
      height: this._element?.clientHeight ?? 0,
    }
  }

  public init(
    element: HTMLElement,
    initialStyle: MapStyleSpecification,
    initialViewport: ViewportLike | undefined,
    options: MapOptions = {}
  ) {
    if (element === this._element && this._map != null) { return }
    if (this._map != null || this._element != null) {
      this.deinit()
    }

    this.queryLoading()

    this._mapStyle = initialStyle
    this._currentMapStyle = initialStyle
    if (initialViewport != null) {
      this._viewport = Viewport.from(initialViewport)
    }

    this._element = element
    this._map = new maptiler_Map({
      container: element,
      style:     this._mapStyle,
      bounds:    this.viewport.bounds(this.size),

      ...options,

      attributionControl:        false,
      forceNoAttributionControl: true,
      fullscreenControl:         false,
      geolocateControl:          false,
      navigationControl:         false,
      scaleControl:              false,
      terrainControl:            false,
    })

    this._map.showTileBoundaries = options.showTileBoundaries ?? false

    // Set up initialization event handlers. These basically all flush the initialization queue.
    this._map.once('load', this.onLoad)
    this._map.once('idle', this.onIdle)
    this._map.on('sourcedata', this.onSourceData)

    this._map.on('dataloading', this.queryLoading.bind(this))
    this._map.on('dataabort', this.queryLoading.bind(this))
    this._map.on('data', this.queryLoading.bind(this))

    // Set up event handlers.
    this._map.once('error', this.onError)
    this._map.on('movestart', this.onMoveStart)
    this._map.on('zoomstart', this.onZoomStart)
    this._map.on('resize', this.onResize)

    this._map.on('moveend', this.emitBoundsChanged.bind(this))
    this._map.on('zoomend', this.emitBoundsChanged.bind(this))
    this._map.on('pitchend', this.emitBoundsChanged.bind(this))
    this._map.on('rotateend', this.emitBoundsChanged.bind(this))

    this.emitBoundsChanged()

    this.disposer(() => {
      this.deinit()
    })

    return () => {
      this.deinit()
    }
  }

  public deinit(element?: HTMLElement) {
    if (this._map == null) { return }
    if (element != null && this._element !== element) { return }

    this._loaded = false
    this._idle = false

    this.currentBackingLayers.clear()
    this.currentMarkers.clear()

    this._map.remove()
    this._element = null
    this._map = null
  }

  private fixDrawStuff() {
    if (this._map == null) { return }
    if (this._map.getCanvas() == null) { return }

    this._map.getCanvas().className = 'mapboxgl-canvas maplibregl-canvas blabla'
    this._map.getContainer().classList.add('mapboxgl-map')
    const canvasContainer = this._map.getCanvasContainer()
    canvasContainer.classList.add('mapboxgl-canvas-container')
    if (canvasContainer.classList.contains('maplibregl-interactive')) {
      canvasContainer.classList.add('mapboxgl-interactive')
    }
  }

  private onLoad() {
    if (this.loaded) { return }

    this._loaded = true
    this.queryLoading()

    this.deriveUnmanagedLayerIDs()
    this.deriveUnmanagedSourceIDs()
    this.syncFeatureStates()
    this.syncBackingLayers()
    this.syncMarkers()
    this.syncRootControls()
    this.syncLabelVisibility()
    this.fixDrawStuff()
    this.operationQueue.flush()
  }

  private onIdle() {
    if (this.idle) { return }

    this._idle = true
    this.operationQueue.flush()
    this.queryLoading()
  }

  private onSourceData() {
    this.syncFeatureStates()
  }

  private onError(event: ErrorEvent) {
    if (!this.idle) {
      this._initializationErrors.push(event.error)
    } else {
      config.logger.error(event.error)
    }
  }

  // #endregion

  // #region Loading

  private _loading: boolean = false
  public get loading() { return this._loading }

  private loadingChangeListeners = new Set<(loading: boolean) => void>()

  private queryLoading() {
    this._loading = this.isLoading()
    this.emitLoadingChange()
  }

  private isLoading() {
    if (this._map == null) { return true }
    if (!this._map.areTilesLoaded()) { return true }

    const sources = this._map.getStyle().sources
    for (const id in sources) {
      if (!this._map.isSourceLoaded(id)) { return true }
    }

    return false
  }

  public addLoadingListener(listener: (loading: boolean) => void) {
    this.loadingChangeListeners.add(listener)
    listener(this.loading)

    return () => {
      this.loadingChangeListeners.delete(listener)
    }
  }

  private emitLoadingChange() {
    for (const listener of this.loadingChangeListeners) {
      listener(this.loading)
    }
  }

  // #endregion

  // #region Viewport

  private resizeTimer = new Timer()
  private userMoved: boolean = false

  private _viewport = Viewport.world()
  public get viewport() { return this._viewport }

  private _nextFitBoundsOptions?:     boolean | FitBoundsOptions
  private _fitBoundsOptionsCallback?: FitBoundsOptionsCallback

  public resetDefaultViewport() {
    this.setDefaultViewport(Viewport.world())
  }

  public setDefaultViewport(viewport: Viewport | ViewportLike) {
    const nextViewport = Viewport.from(viewport)
    if (this._viewport.equals(nextViewport)) { return }

    this._viewport = nextViewport
    if (!this.userMoved) {
      this.fitToViewport(FitBoundsReason.DefaultViewportChanged)
    }
  }

  public resetViewport() {
    this.fitToViewport(FitBoundsReason.ViewportReset)
  }

  public setNextFitBoundsOptions(options: boolean | FitBoundsOptions) {
    this._nextFitBoundsOptions = options
  }

  public setFitBoundsOptionsCallback(callback: FitBoundsOptionsCallback) {
    this._fitBoundsOptionsCallback = callback
  }

  private getFitBoundsOptions(reason: FitBoundsReason, from: BBox, to: BBox): boolean | FitBoundsOptions {
    if (this._nextFitBoundsOptions != null) {
      const options = this._nextFitBoundsOptions
      this._nextFitBoundsOptions = undefined
      return options
    }

    if (this._fitBoundsOptionsCallback != null) {
      return this._fitBoundsOptionsCallback(reason, from, to)
    }

    return true
  }

  @queueUntil(({model}) => model.idle)
  private fitToViewport(reason: FitBoundsReason) {
    const map = this._map
    if (map == null) { return }

    const currentBBox = lngLatBoundsToBBox(map.getBounds())
    const nextBBox = this.viewport.bbox(this.size)
    if (currentBBox.equals(nextBBox)) { return }

    const options = this.getFitBoundsOptions(reason, currentBBox, nextBBox)
    if (options === false) { return }

    this._map?.fitBounds(nextBBox.geojson, options === true ? {} : options)
    this.userMoved = false
  }

  private onMoveStart = (event: MapLibreEvent) => {
    if (event.originalEvent == null) { return } // This was a move initiated by maplibre, not by the user.
    this.userMoved = true
  }

  private onZoomStart = (event: MapLibreEvent) => {
    if (event.originalEvent == null) { return } // This was a move initiated by maplibre, not by the user.
    this.userMoved = true
  }
    
  private onResize = () => {
    if (this.userMoved) { return }

    this.resizeTimer.debounce(() => {
      this.fitToViewport(FitBoundsReason.MapResized)
    }, 500)
  }

  // #endregion

  // #region Bounds

  private boundsListeners = new Set<BoundsListener>()

  public getBounds(): LngLatBounds | null {
    return this.map?.getBounds() ?? null
  }

  public addBoundsListener(listener: BoundsListener) {
    this.boundsListeners.add(listener)
    if (this.map != null) {
      listener(this.map.getBounds())
    }
  }

  private emitBoundsChanged() {
    if (this.map == null) { return }
    
    const bounds = this.map.getBounds()
    this.boundsListeners.forEach(it => it(bounds))
  }

  // #endregion

  // #region Style

  private styleTimer = new Timer()

  private _mapStyle: MapStyleSpecification = config.defaultStyle
  public get mapStyle() { return this._mapStyle }

  private _currentMapStyle: MapStyleSpecification | null = null

  public setMapStyle(mapStyle: MapStyleSpecification) {
    if (mapStyle === this._mapStyle) { return }
    this._mapStyle = mapStyle

    this.styleTimer.debounce(() => { this.syncMapStyle() }, config.updateDebounce)
  }

  @queueUntil(({model}) => model.loaded)
  private syncMapStyle() {
    if (this._map == null) { return }
    if (this._mapStyle === this._currentMapStyle) { return }
    
    this._map.once('styledata', () => {
      this.deriveUnmanagedLayerIDs()
      this.syncBackingLayers()
      this.syncMarkers()
      this.syncLabelVisibility()
    })

    this._map.setStyle(this.mapStyle)
    this._currentMapStyle = this._mapStyle
  }

  // #endregion

  // #region Polygons

  private polygonTimer = new Timer()
  private polygons = new Map<string, [PolygonConfig, PolygonOptions]>()
  
  public addPolygon(id: string, polygon: PolygonConfig, options: PolygonOptions = {}) {
    this.polygons.set(id, [polygon, options])
    this.polygonTimer.debounce(() => this.syncBackingLayers(), config.updateDebounce)

    return () => {
      this.polygons.delete(id)
      this.polygonTimer.debounce(() => this.syncBackingLayers(), config.updateDebounce)
    }
  }

  private buildPolySource(polygon: PolygonConfig): SourceSpecification {
    return {
      type: 'geojson',
      data: {
        id:         0,
        type:       'Feature',
        geometry:   polygon.geometry.geojson,
        properties: {},
      },
    }
  }

  private buildPolygonFillLayer(id: string, polygon: PolygonConfig): BackingLayer {
    const fillOpacity = polygon.fillOpacity ?? 0.6
    const fillHoverOpacity = polygon.hover ? fillOpacity + 0.1 : fillOpacity

    return {
      id:     `${id}:fill`,
      source: id,
      type:   'fill',
      paint:  {
        'fill-color':     polygon.color,
        'fill-opacity':   polygon.hover ? ['case', ['boolean', ['feature-state', 'hover'], false], fillHoverOpacity, fillOpacity] : fillOpacity,
        'fill-antialias': true,
      },
    }
  }

  private buildPolygonOutlineLayer(id: string, polygon: PolygonConfig): BackingLayer {
    return {
      id:     `${id}:outline`,
      source: id,
      type:   'line',
      layout: {'line-cap': 'round', 'line-join': 'round'},
      paint:  {
        'line-color':     polygon.lineColor ?? polygon.color,
        'line-opacity':   polygon.lineOpacity ?? 1,
        'line-width':     polygon.lineWidth ?? 1,
        'line-dasharray': polygon.lineStyle === LineStyle.Dashed ? [0.2, 2] : [1, 0],
      },
    }
  }

  // #endregion

  // #region Backing layers

  // Backing layers are the map-level layers that drive polygons and tile layers.

  private unmanagedLayerIDs = new Set<string>()
  private unmanagedSourceIDs = new Set<string>()

  private layerTimer = new Timer()

  private readonly _tileLayerBackingLayers = new Map<string, [string, BackingLayer, BackingLayerOptions]>()
  private readonly _tileLayerSources = new Map<string, [string, VectorSourceSpecification | RasterSourceSpecification]>()

  private currentBackingLayers = new Map<string, [string, BackingLayer]>()

  public ensureBackingLayer(parentName: string, layer: BackingLayer, options: BackingLayerOptions = {}) {
    if (this._tileLayerBackingLayers.has(layer.id)) { return }

    this._tileLayerBackingLayers.set(layer.id, [parentName, layer, options])
    this.syncBackingLayersSoon()

    return () => {
      if (!this._tileLayerBackingLayers.has(layer.id)) { return }
      
      this._tileLayerBackingLayers.delete(layer.id)
      this.syncBackingLayersSoon()
    }
  }

  public updateBackingLayerPaint(layerID: string, paint: LayerSpecification['paint']) {
    if (this._map == null) { return }
    if (this._map.style?.getLayer(layerID) == null) { return }

    for (const [key, value] of Object.entries(paint ?? {})) {
      this._map.setPaintProperty(layerID, key, value)
    }
  }

  public ensureTileLayerSource(id: string, url: string, source: VectorSourceSpecification | RasterSourceSpecification) {
    const prevURL = this._tileLayerSources.get(id)?.[0]
    if (url === prevURL) { return }

    const existingSource = this._map?.getSource(id)
    this._tileLayerSources.set(id, [url, source])

    if (prevURL == null) {
      this.syncBackingLayersSoon()
    } else if (existingSource != null && 'setTiles' in existingSource && isFunction(existingSource.setTiles)) {
      existingSource.setTiles([url])
    } else {
      this.reloadTileLayerSource(id, url)
    }
  }

  public removeSource(id: string) {
    if (!this._tileLayerSources.has(id)) { return }
    this._tileLayerSources.delete(id)

    this.syncBackingLayersSoon()
  }

  private deriveUnmanagedLayerIDs() {
    if (this._map == null) { return }
    
    const layerIDs = this._map.style.getLayersOrder()
    this.unmanagedLayerIDs = new Set(layerIDs)
  }

  private deriveUnmanagedSourceIDs() {
    if (this._map == null) { return }

    const sourceIDs = objectKeys(this._map.getStyle()?.sources ?? {}).map(it => it.toString())
    this.unmanagedSourceIDs = new Set(sourceIDs)
  }

  private backingLayersTimer = new Timer()
  private syncBackingLayersSoon() {
    this.backingLayersTimer.debounce(
      () => this.syncBackingLayers(),
      config.updateDebounce
    )
  } 

  /**
   * Synchronizes backing layers for tile layers & polygons.
   * @returns 
   */
  @queueUntil(({model}) => model.loaded)
  private syncBackingLayers() {
    if (this._map == null) { return }

    const style = this._map.getStyle()
    if (style == null) { return }

    try {
      config.logger.groupCollapsed("SYNC")

      // 1. First ensure all sources are there.
      const currentSourceIDs = (objectKeys(style.sources) as string[]).filter(it => !this.unmanagedSourceIDs.has(it))
      const currentLayerIDs = this._map.style.getLayersOrder().filter(it => !this.unmanagedLayerIDs.has(it))

      const remainingSourceIDs = new Set(currentSourceIDs)
      const remainingLayerIDs = new Set(currentLayerIDs)

      this.ensureTileLayerSources(remainingSourceIDs)
      this.ensureTileLayerBackingLayers(remainingLayerIDs)

      this.ensurePolygonSources(remainingSourceIDs)
      this.ensurePolygonBackingLayers(remainingLayerIDs)

      this.removeRemainingLayers(remainingLayerIDs)
      this.removeRemainingSources(remainingSourceIDs)
      
      config.logger.groupEnd()
    } catch (error) {
      config.logger.groupEnd()
      config.logger.error(error)
    }
  }

  public logLayers() {
    if (this._map == null) { return }

    const layerIDs = this._map.getLayersOrder()

    for (const id of layerIDs) {
      const layer = this._map.getLayer(id)
      if (layer == null) { continue }
    }
  }

  private ensureTileLayerSources(remainingSourceIDs: Set<string>) {
    config.logger.debug('TILE SOURCES')
    config.logger.debug('nextSourceIDs:', Array.from(this._tileLayerSources.keys()).join(', '))

    for (const [id, [url, source]] of this._tileLayerSources) {
      if (remainingSourceIDs.has(id)) {
        remainingSourceIDs.delete(id)
      } else {
        const spec = {...source, tiles: [url]}

        config.logger.debug('  ADD', id, `(url=${url})`)
        this._map?.addSource(id, spec)
      }
    }
  }

  private ensureTileLayerBackingLayers(remainingLayerIDs: Set<string>) {
    config.logger.debug('TILE LAYERS')
    config.logger.debug('nextLayerIDs:', Array.from(this._tileLayerBackingLayers.keys()).join(', '))

    for (const [id, [parentName, layer, options]] of this._tileLayerBackingLayers) {
      if (remainingLayerIDs.has(id)) {
        remainingLayerIDs.delete(id)
      } else {
        config.logger.debug('  ADD', id, `(source=${(layer as any).source})`)
        this.mapLayersOrdering.addLayer(layer, options)
        this.currentBackingLayers.set(id, [parentName, layer])

        this.setUpBackingLayerInteraction(id)
      }
    }
  }

  private ensurePolygonSources(remainingSourceIDs: Set<string>) {
    for (const [id, [polygon]] of this.polygons) {
      if (remainingSourceIDs.has(id)) {
        remainingSourceIDs.delete(id)
      } else {
        const source = this.buildPolySource(polygon)
        this._map?.addSource(id, source)
      }
    }
  }

  private ensurePolygonBackingLayers(remainingLayerIDs: Set<string>) {
    config.logger.info('POLYGON LAYERS')
    config.logger.info('polygonIDs:', Array.from(this.polygons.keys()).join(', '))

    for (const [id, [polygon, options]] of this.polygons) {
      const fillLayer = this.buildPolygonFillLayer(id, polygon)
      const lineLayer = this.buildPolygonOutlineLayer(id, polygon)

      remainingLayerIDs.delete(fillLayer.id)
      remainingLayerIDs.delete(lineLayer.id)

      this.mapLayersOrdering.addLayer(fillLayer, options)
      this.mapLayersOrdering.addLayer(lineLayer, options)
      this.setUpBackingLayerInteraction(fillLayer.id)
    }
  }

  private removeRemainingLayers(remainingLayerIDs: Set<string>) {
    config.logger.debug('REMAINING LAYERS')

    for (const id of remainingLayerIDs) {
      config.logger.debug('  REMOVE', id)

      this.tearDownBackingLayerInteraction(id)
      this.mapLayersOrdering.removeLayer(id)
      this.currentBackingLayers.delete(id)
    }
  }

  private removeRemainingSources(remainingSourceIDs: Set<string>) {
    config.logger.debug('REMAINING SOURCES')

    for (const id of remainingSourceIDs) {
      config.logger.debug('  REMOVE', id)
      this._map?.removeSource(id)
    }
  }

  public async reloadTileLayerSource(sourceID: string, url?: string) {
    const source = this._tileLayerSources.get(sourceID)
    if (source == null) { return }

    config.logger.groupCollapsed("RELOAD", sourceID, url)

    const mapSource = this._map?.getSource(sourceID)
    config.logger.debug('sourceID:', sourceID)

    if (mapSource != null && 'tiles' in mapSource && 'setTiles' in mapSource && isFunction(mapSource.setTiles)) {
      mapSource.setTiles([url ?? mapSource.tiles])
      return
    }

    if (this._map != null && mapSource != null) {
      // Temporarily remove all layers that depend on this source.
      const layerIDs = this.layerIDsDependingOnSource(sourceID)
      for (const id of layerIDs) {
        this.mapLayersOrdering.removeLayer(id)
        config.logger.debug('removed', id, this._map.style.getLayersOrder())
      }

      // Remove the source and then run the sync function to add everything back.
      // Temporarily disable the sourcedata event because it will be fired when the source is removed.
      // this._map.off('sourcedata', this.onSourceData)
      this._map.removeSource(sourceID)
      // this._map.on('sourcedata', this.onSourceData)
    }

    // If a new URL is specified, update it.
    if (url != null && url !== source[0]) {
      this._tileLayerSources.set(sourceID, [url, source[1]])
    }

    this.syncBackingLayersSoon()
    config.logger.groupEnd()
  }

  private layerIDsDependingOnSource(sourceID: string) {
    const map = this._map
    if (map == null) { return [] }

    const layerIDs = map.style.getLayersOrder()
    return layerIDs.filter(layerID => {
      const layer = map.style.getLayer(layerID)
      if (layer == null) { return false }
      return layer.source === sourceID
    })
  }

  @queueUntil(({model}) => model.idle)
  private setUpBackingLayerInteraction(prefixedID: string) {
    if (this._map == null) { return }
    if (this._map.style == null) { return }

    this.tearDownBackingLayerInteraction(prefixedID)

    // Before binding, check if this backing layer has a listener at all. If not, there is no use listening
    // to the event (and more importantly, we don't want to show the pointer cursor).
    const listener = this.backingLayerClickListeners.get(prefixedID)
    if (listener == null) { return }

    const layer = this._map.style.getLayer(prefixedID)
    if (layer == null) { return}
    config.logger.info('add event listeners for layer:', layer.id)
    this._map.on('click', prefixedID, this.onBackingLayerClick)
    this._map.on('mouseenter', prefixedID, this.onBackingLayerMouseMove)
    this._map.on('mouseleave', prefixedID, this.onBackingLayerMouseLeave)
  }

  private tearDownBackingLayerInteraction(prefixedID: string) {
    if (this._map == null) { return }
    if (this._map.style == null) { return }

    this._map.off('click', prefixedID, this.onBackingLayerClick)
    this._map.off('mouseenter', prefixedID, this.onBackingLayerMouseMove)
    this._map.off('mouseleave', prefixedID, this.onBackingLayerMouseLeave)
  }

  private previousClickedFeatureKey: string | null = null

  private onBackingLayerClick = (event: MapLayerMouseEvent) => {
    const {features = []} = event
    if (features.length === 0) { return }

    const layerID = features[0].layer.id
    const listener = this.backingLayerClickListeners.get(layerID)

    if (features.length < 2) {
      listener?.(event, features[0])
      this.previousClickedFeatureKey = null
    } else {
      // Multiple features are within hit area, cycle through them.
      const keys = features.map(it => `${it.layer.id}::${it.id}`)
      const prevIndex = this.previousClickedFeatureKey == null ? -1 : keys.indexOf(this.previousClickedFeatureKey)
      const nextIndex = (prevIndex + 1) % keys.length

      listener?.(event, features[nextIndex])
      this.previousClickedFeatureKey = keys[nextIndex]
    }
  }

  private showPointerCursor = () => {
    if (this._map == null) { return }
    this._map.getCanvas().style.cursor = 'pointer'
  }

  private showDefaultCursor = () => {
    if (this._map == null) { return }
    this._map.getCanvas().style.cursor = ''
  }

  private getFeatureIdentifierFromEvent(ev: MapLayerMouseEvent): FeatureIdentifier | null {
    const f = ev.features?.[0]
    if (!f) return null
    // For GeoJSON sources, sourceLayer is undefined; id must be set on the Feature.
    if (f.source == null || f.id == null) return null
    return (f.sourceLayer != null)
      ? {source: f.source as string, sourceLayer: f.sourceLayer as string, id: f.id as number | string}
      : {source: f.source as string, id: f.id as number | string}
  }

  private lastHoverFeature: FeatureIdentifier | null = null

  private onBackingLayerMouseMove = (event: MapLayerMouseEvent) => {
    if (this._map == null) { throw new Error('Map is not initialized') }

    const identifier = this.getFeatureIdentifierFromEvent(event)
    if (!identifier) return

    if (this.lastHoverFeature != null && !objectEquals(this.lastHoverFeature, identifier)) {
      // Clear hover on the previously hovered feature
      this.setFeatureState(this.lastHoverFeature, {hover: false})
    }

    this.showPointerCursor()
    this.setFeatureState(identifier, {hover: true})
    this.lastHoverFeature = identifier
  }

  private onBackingLayerMouseLeave = () => {
    if (this._map == null) { return }

    if (!this.lastHoverFeature) return

    // Clear hover on the feature when leaving the layer entirely
    this.setFeatureState(this.lastHoverFeature, {hover: false})
    this.showDefaultCursor()
    this.lastHoverFeature = null
  }

  // #endregion

  // #region Layer groups

  private mapLayersOrdering = new MapLayersOrdering(
    () => this.mapStyle,
    () => this._map?.style.getLayersOrder() ?? [],
    (layer, insertBefore) => {
      // try {
      // console.groupEnd()
      // console.group(">>>>", layer.id)
      // console.log("LAYER", layer)
      // console.log("SOURCE", this._map?.getSource((layer as any).source))
      this._map?.style.addLayer(layer, insertBefore)
      // console.log(JSON.stringify(this._map?.style.getLayersOrder(), null, 2))
      // console.groupEnd()
      // } catch (error) {
      //   console.error(error)
      // }
    },
    id => {
      // console.log("<<<<", id)
      this._map?.removeLayer(id)
    }
  )

  public registerLayerGroup(name: string, ordering: LayerGroupOrdering) {
    // TODO Double rendering.
    this.mapLayersOrdering.addGroup(name, ordering)
    this.syncBackingLayersSoon()

    return () => {
      this.mapLayersOrdering.removeGroup(name)
      this.syncBackingLayersSoon()
    }
  }

  // #endregion

  // #region Label visibility

  private _labelsVisible: boolean = true
  public get labelsVisible() { return this._labelsVisible }

  public setLabelsVisible(visible: boolean) {
    this._labelsVisible = visible
    this.syncLabelVisibility()
  }

  @queueUntil(({model}) => model.loaded)
  private syncLabelVisibility() {
    if (this._map == null) { return }

    const style = this._map.getStyle()
    if (style == null) { return }

    const layers = style.layers
    const labelLayers = layers.filter(it => it.id.endsWith(' labels'))
    for (const layer of labelLayers) {
      this._map.setLayoutProperty(layer.id, 'visibility', this.labelsVisible ? 'visible' : 'none')
    }
  }

  // #endregion

  // #region Interaction

  public on<T extends keyof MapLayerEventType>(type: T, layer: string, listener: (ev: MapLayerEventType[T]) => void): () => void
  public on<T extends keyof MapEventType>(type: T, listener: (ev: MapEventType[T]) => void): () => void
  public on<T extends keyof MapBoxDrawEventType>(type: T, listener: (ev: MapBoxDrawEventType[T]) => void): () => void
  @queueUntil(({model}) => model.idle)
  public on(...args: any[]) {
    const map = this._map
    if (map == null) { return () => {} }

    map.on.apply(map, args as any)
    return () => {
      map?.off.apply(map, args as any)
    }
  }

  // Heb je deze expres nooit gemaakt @joost? (by @daan)
  public off<T extends keyof MapLayerEventType>(type: T, layer: string, listener: (ev: MapLayerEventType[T]) => void): void
  public off<T extends keyof MapEventType>(type: T, listener: (ev: MapEventType[T]) => void):  void
  public off<T extends keyof MapBoxDrawEventType>(type: T, listener: (ev: MapBoxDrawEventType[T]) => void): void
  @queueUntil(({model}) => model.idle)
  public off(...args: any[]) {
    const map = this._map
    if (map == null) { return }

    map.off.apply(map, args as any)
  }

  private backingLayerClickListeners = new Map<string, LayerClickListener>()

  /**
   * Adds a click event listener to a polygon.
   * 
   * @param layer The layer ID to add the listener to.
   * @param listener The click listeren.
   */
  public addPolygonClickListener(polygonID: string, listener: LayerClickListener) {
    const removeFill = this.addBackingLayerClickListener(`${polygonID}:fill`, listener)

    // Return a disposer that removes both bindings.
    return () => {
      removeFill?.()
    }
  }

  /**
   * Adds a click event listener to a TileLayer backing layer. 
   * 
   * @param layer The layer ID to add the listener to.
   * @param listener The click listeren.
   */
  public addTileBackingLayerClickListener(layerID: string, listener: LayerClickListener) {
    return this.addBackingLayerClickListener(layerID, listener)
  }

  private addBackingLayerClickListener(prefixedID: string, listener: LayerClickListener) {
    this.tearDownBackingLayerInteraction(prefixedID)
    this.backingLayerClickListeners.set(prefixedID, listener)
    this.setUpBackingLayerInteraction(prefixedID)
    return () => {
      this.removeBackingLayerClickListener(prefixedID)
    }
  }

  /**
   * Removes a click event listener from a (backing) layer.
   */
  private removeBackingLayerClickListener(prefixedID: string) {
    this.tearDownBackingLayerInteraction(prefixedID)
    this.backingLayerClickListeners.delete(prefixedID)
  }

  // #endregion

  // #region Markers

  private markerTimer = new Timer()

  private markers = new Map<string, [Geometry<Point>, HTMLElement, MarkerOptions, () => any]>()
  private currentMarkers = new Map<string, Marker>()

  public addMarker(id: string, location: Geometry<Point>, element: HTMLElement | null, options: MarkerOptions = {}, onAdded?: () => any): () => void {
    if (element == null) {
      this.markers.delete(id)
    } else {
      this.markers.set(id, [location, element, options, onAdded ?? (() => undefined)])
    }
    this.markerTimer.debounce(() => this.syncMarkers(), config.updateDebounce)

    return () => {
      this.markers.delete(id)
      this.markerTimer.debounce(() => this.syncMarkers(), config.updateDebounce)
    }
  }

  private syncMarkers() {
    if (this._map == null) { return }

    const toRemove = new Map(this.currentMarkers)
    
    for (const [id, [location, element, options, onAdded]] of this.markers.entries()) {
      toRemove.delete(id)

      let marker = this.currentMarkers.get(id)
      if (marker == null) {
        marker = new Marker({
          element,
          anchor: 'bottom',

          // For some reason, the marker is considered "covered" when a GeoJSON polygon is added. 
          // Not sure if it's intentional or not, but this makes sure the markers are always 100% opaque.
          opacityWhenCovered: '1.0',

          ...options,
        })
        
        marker.setLngLat([location.coordinates[0], location.coordinates[1]])
        marker.addTo(this._map)
        this.currentMarkers.set(id, marker)
        onAdded()
      } else {
        marker.setLngLat([location.coordinates[0], location.coordinates[1]])
      }
    }

    for (const [id, marker] of toRemove.entries()) {
      marker.remove()
      this.currentMarkers.delete(id)
    }
  }

  // #endregion

  // #region Controls & attribution

  // ROOT CONTROLS
  // ============
  // Root controls are the controls that are added to the map directly.

  private rootControls:        Array<[IControl, ControlPosition]> = []
  private currentRootControls: IControl[] = []

  public addRootControl(control: IControl, position: ControlPosition) {
    this.rootControls.push([control, position])
    this.syncRootControls()

    return this.removeRootControl.bind(this, control)
  }

  public removeRootControl(control: IControl) {
    const index = this.rootControls.findIndex(it => it[0] === control)
    if (index < 0) { return }

    this.rootControls.splice(index, 1)
    this.syncRootControls()
  }

  @queueUntil(({model}) => model.loaded)
  private syncRootControls() {
    if (this._map == null) { return }

    for (const control of this.currentRootControls) {
      this._map.removeControl(control)
    }
    for (const [control, position] of this.rootControls) {
      this._map.addControl(control, position)
    }

    this.currentRootControls = this.rootControls.map(it => it[0])
  }

  // CHILD CONTROLS
  // =============
  // Child controls are the maptiler controls that are instantiated as children of the map element. Because
  // they need to register with the map, but are placed within a react element, we need to handle them separately.
  
  private childControls:        Array<[IControl, HTMLElement]> = []
  private currentChildControls: Array<[IControl, HTMLElement]> = []

  public registerChildControl(control: IControl, parent: HTMLElement) {
    this.childControls.push([control, parent])
    this.syncChildControls()

    return this.unregisterControl.bind(this, control)
  }

  public unregisterControl(control: IControl) {
    const index = this.childControls.findIndex(it => it[0] === control)
    if (index < 0) { return }

    this.childControls.splice(index, 1)
    this.syncChildControls()
  }

  @queueUntil(({model}) => model.loaded)
  private syncChildControls() {
    if (this._map == null) { return }

    const remaining = [...this.currentChildControls]
    const nextChildControls: Array<[IControl, HTMLElement]> = []

    for (const [control, parent] of this.childControls) {
      const existingIndex = remaining.findIndex(it => it[0] === control)

      if (existingIndex < 0) {
        // Add it now.
        const element = control.onAdd(this._map)
        parent.appendChild(element)
        nextChildControls.push([control, element])
      } else {
        // Make sure it doesn't get removed.
        nextChildControls.push(remaining[existingIndex])
        remaining.splice(existingIndex, 1)
      }
    }

    for (const [control, element] of remaining) {
      control.onRemove(this._map)
      element.parentElement?.removeChild(element)
    }

    this.currentChildControls = nextChildControls
  }

  // #endregion

  // #region Data

  // Like many things in MapTiler, feature states are bound to sources. That means, if ever we reload a source,
  // all feature data is lost. Therefore, we keep all feature state directives in memory and reapply them
  // when the source is reloaded.

  private featureStateDirectives = new Map<string, FeatureStateDirective>()

  public setFeatureState<T extends object>(feature: FeatureIdentifier, state: T | ((prev: T | undefined) => T)) {
    const key = this.featureKey(feature)

    const existing = this.featureStateDirectives.get(key)

    if (existing != null) {
      existing.state = isFunction(state) ? state(existing.state as T) : {...existing.state, ...state}
    } else {
      this.featureStateDirectives.set(key, {
        feature,
        state: isFunction(state) ? state(undefined) : state,
      })
    }

    this.syncFeatureStates()
  }

  @queueUntil(({model}) => model.loaded)
  public syncFeatureStates() {
    if (this._map == null) { return }

    let modified: boolean = false
    for (const directive of this.featureStateDirectives.values()) {
      if (!this.isFeatureSourceLoaded(directive.feature)) { continue }
      
      const currentState = this._map.getFeatureState(directive.feature) ?? {}
      if (objectEquals(currentState, directive.state)) { continue }

      this._map.setFeatureState(directive.feature, directive.state)
      modified = true
    }

    if (modified) {
      this.forceRepaint()
    }
  }

  private featureKey(feature: FeatureIdentifier) {
    return `${feature.source}:${feature.sourceLayer}:${feature.id}`
  }

  private isFeatureSourceLoaded(feature: FeatureIdentifier) {
    const source = this._map?.getSource(feature.source)
    if (source == null) { return false }

    return source.loaded()
  }

  private forceRepaint() {
    if (this._map == null) { return }

    for (const [, layer] of this.currentBackingLayers.values()) {
      this._map.setLayoutProperty(layer.id, 'visibility', 'none')
      this._map.setLayoutProperty(layer.id, 'visibility', 'visible')
    }
  }

  // #endregion

}

// #region Options types

export type MapOptions = Omit<maptiler_MapOptions,
  | 'container'
  | 'style'
  | 'bounds'
  | 'center'
  | 'zoom'

  // Controls are handled using child elements in the map.
  | 'attributionControl'
  | 'forceNoAttributionControl'
  | 'fullscreenControl'
  | 'navigationControl'
  | 'scaleControl'
  | 'terrainControl'
> & {
  attributionPosition?: ControlPosition
  showTileBoundaries?:  boolean
}

export type FitBBoxOptions = Omit<FitBoundsOptions, 'center' | 'zoom'>

interface AddBackingLayersOptions {
  group?: string
}

export type PolygonOptions = AddBackingLayersOptions
export type BackingLayerOptions = AddBackingLayersOptions

export type BoundsListener = (bounds: LngLatBounds) => void

// #endregion

// #region Internal types

type LayerClickListener = (event: MapMouseEvent, feature?: MapGeoJSONFeature) => void

interface FeatureStateDirective {
  feature: FeatureIdentifier
  state:   Record<string, any>
}

// #endregion

function lngLatBoundsToBBox(bounds: ReturnType<maptiler_Map['getBounds']>): BBox {
  return new BBox([
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ])
}