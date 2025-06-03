import {
  ControlPosition,
  FeatureIdentifier,
  FitBoundsOptions,
  IControl,
  LayerSpecification,
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
import { TileLayer } from '@maptiler/weather'
import { Point } from 'geojson'
import { BBox, Geometry } from 'geojson-classes'
import { isFunction, isPlainObject } from 'lodash'
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

    this._mapStyle = initialStyle
    if (initialViewport != null) {
      this._viewport = Viewport.from(initialViewport)
    }

    this._element = element
    this._map = new maptiler_Map({
      container: element,
      style:     this._mapStyle,
      bounds:    this.viewport.bounds(this.size),

      ...options,
    })

    // Set up initialization event handlers. These basically all flush the initialization queue.
    this._map.once('load', this.onLoad)
    this._map.once('idle', this.onIdle)
    this._map.on('sourcedata', this.onSourceData)

    // Set up event handlers.
    this._map.once('error', this.onError)
    this._map.on('movestart', this.onMoveStart)
    this._map.on('zoomstart', this.onZoomStart)
    this._map.on('resize', this.onResize)

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

  private onLoad() {
    if (this.loaded) { return }

    this._loaded = true

    this.syncFeatureStates()
    this.syncBackingLayers()
    this.syncMarkers()
    this.syncControls()
    this.syncLabelVisibility()
    this.operationQueue.flush()
  }

  private onIdle() {
    if (this.idle) { return }

    this._idle = true
    this.operationQueue.flush()
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

    this._map?.fitBounds(nextBBox.bbox, options === true ? {} : options)
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

  // #region Style

  private styleTimer = new Timer()

  private _mapStyle: MapStyleSpecification = config.defaultStyle
  public get mapStyle() { return this._mapStyle }

  public setMapStyle(mapStyle: MapStyleSpecification) {
    if (mapStyle === this._mapStyle) { return }
    this._mapStyle = mapStyle

    this.styleTimer.debounce(() => { this.syncMapStyle() }, config.updateDebounce)
  }

  @queueUntil(({model}) => model.loaded)
  private syncMapStyle() {
    if (this._map == null) { return }
    if (this.isCurrentStyle(this._mapStyle)) { return }

    this._map.once('styledata', () => {
      this.syncBackingLayers()
      this.syncMarkers()
      this.syncLabelVisibility()
    })

    this._map.setStyle(this.mapStyle)
  }

  private isCurrentStyle(style: MapStyleSpecification) {
    if (this._map == null) { return false }
    if (this._map.getStyle() == null) { return false }
    if (this._map.getStyle() === style) { return true }

    if ('id' in this._map.style.stylesheet && this._map.style.stylesheet.id === style) {
      return true
    }

    return false
  }

  // #endregion

  // #region Visualization time

  private _visualizationTime: Date = new Date()
  public get visualizationTime() { return this._visualizationTime }

  public setVisualizationTime(time: Date) {
    if (time === this._visualizationTime) { return }
    this._visualizationTime = time

    this.syncLayersWithTime()
  }

  private syncLayersWithTime() {
    if (this._map == null) { return }

    // Only applicable to tile layers.
    const layerIDs = this._map.style.getLayersOrder().filter(
      it => it.startsWith(config.layerPrefix('tile'))
    )

    for (const id of layerIDs) {
      const backingLayerEntry = this._tileLayerBackingLayers.get(id)
      if (backingLayerEntry == null) { continue }

      const [, layer] = backingLayerEntry
      if (!(layer instanceof TileLayer)) { continue }

      const currentTime = layer.getAnimationTimeDate()
      if (currentTime.getTime() === this.visualizationTime.getTime()) { continue }

      layer.setAnimationTime(this.visualizationTime.getTime() / 1000)
    }
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
        type:       'Feature',
        geometry:   polygon.geometry.geojson,
        properties: {},
      },
    }
  }

  private buildPolyFillLayer(id: string, polygon: PolygonConfig): BackingLayer {
    return {
      id:     this.polygonFillLayerID(id),
      source: this.polygonSourceID(id ),
      type:   'fill',
      paint:  {
        'fill-color':     polygon.color,
        'fill-opacity':   polygon.fillOpacity,
        'fill-antialias': true,
      },
    }
  }

  private buildPolyLineLayer(id: string, polygon: PolygonConfig): BackingLayer {
    return {
      id:     this.polygonLineLayerID(id),
      source: this.polygonSourceID(id ),
      type:   'line',
      paint:  {
        'line-color':   polygon.color,
        'line-opacity': polygon.lineOpacity,
      },
    }
  }

  // #endregion

  // #region Backing layers

  // Backing layers are the map-level layers that drive polygons and tile layers.

  private layerTimer = new Timer()

  private readonly _tileLayerBackingLayers = new Map<string, [string, BackingLayer, BackingLayerOptions]>()
  private readonly _tileLayerSources = new Map<string, [string, VectorSourceSpecification | RasterSourceSpecification]>()

  private currentBackingLayers = new Map<string, [string, BackingLayer]>()

  public ensureBackingLayer(parentName: string, layer: BackingLayer, options: BackingLayerOptions = {}) {
    const prefixedID = layer.id.startsWith(config.layerPrefix('tile')) ? layer.id : this.tileLayerBackingLayerID(layer.id)
    if (this._tileLayerBackingLayers.has(prefixedID)) { return }

    this._tileLayerBackingLayers.set(prefixedID, [parentName, layer, options])
    this.syncBackingLayers()

    return () => {
      if (!this._tileLayerBackingLayers.has(prefixedID)) { return }
      
      this._tileLayerBackingLayers.delete(prefixedID)
      this.syncBackingLayers()
    }
  }

  public updateBackingLayerPaint(layerID: string, paint: LayerSpecification['paint']) {
    if (this._map == null) { return }

    const prefixedID = this.tileLayerBackingLayerID(layerID)
    if (this._map.style?.getLayer(prefixedID) == null) { return }

    
    for (const [key, value] of Object.entries(paint ?? {})) {
      this._map.setPaintProperty(prefixedID, key, value)
    }
  }

  public ensureTileLayerSource(id: string, url: string, source: VectorSourceSpecification | RasterSourceSpecification) {
    const prevURL = this._tileLayerSources.get(id)?.[0]
    if (url === prevURL) { return }

    const existingSource = this._map?.getSource(this.tileLayerSourceID(id))
    this._tileLayerSources.set(id, [url, source])

    if (prevURL == null) {
      this.syncBackingLayers()
    } else if (existingSource != null && 'setTiles' in existingSource && isFunction(existingSource.setTiles)) {
      existingSource.setTiles([url])
    } else {
      this.reloadTileLayerSource(id, url)
    }
  }

  public removeSource(id: string) {
    if (!this._tileLayerSources.has(id)) { return }
    this._tileLayerSources.delete(id)

    this.syncBackingLayers()
  }

  /**
   * Synchronizes backing layers for tile layers & polygons.
   * @returns 
   */
  private syncBackingLayers() {
    if (this._map == null) { return }

    const style = this._map.getStyle()
    if (style == null) { return }

    try {
      config.logger.groupCollapsed("SYNC")

      const filterWithPrefix = (ids: string[]) => {
        return ids.filter(it => it.startsWith(config.layerPrefix('tile')) || it.startsWith(config.layerPrefix('polygon')))
      }

      // 1. First ensure all sources are there.
      const currentSourceIDs = filterWithPrefix(objectKeys(style.sources) as string[])
      const currentLayerIDs = filterWithPrefix(this._map.style.getLayersOrder())
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

  private ensureTileLayerSources(remainingSourceIDs: Set<string>) {
    config.logger.debug('TILE SOURCES')
    config.logger.debug('nextSourceIDs:', Array.from(this._tileLayerSources.keys()).join(', '))

    for (const [id, [url, source]] of this._tileLayerSources) {
      const prefixedID = this.tileLayerSourceID(id)
      if (remainingSourceIDs.has(prefixedID)) {
        remainingSourceIDs.delete(prefixedID)
      } else {
        const spec = {...source, tiles: [url]}

        config.logger.debug('  ADD', id, `(prefixed=${prefixedID}, url=${url})`)
        this._map?.addSource(prefixedID, spec)
      }
    }
  }

  private ensureTileLayerBackingLayers(remainingLayerIDs: Set<string>) {
    config.logger.debug('TILE LAYERS')
    config.logger.debug('nextLayerIDs:', Array.from(this._tileLayerBackingLayers.keys()).join(', '))

    for (const [id, [parentName, layer, options]] of this._tileLayerBackingLayers) {
      const prefixedID = this.tileLayerBackingLayerID(id)

      if (remainingLayerIDs.has(prefixedID)) {
        remainingLayerIDs.delete(prefixedID)
      } else {
        if (!layer.id.startsWith(config.layerPrefix('tile'))) {
          layer.id = prefixedID
        }

        // Same with the source, if there is a source specified.
        if (isPlainObject(layer) && 'source' in layer && layer.source != null && !layer.source.startsWith(config.layerPrefix('tile'))) {
          layer.source = this.tileLayerSourceID(layer.source)
        }

        config.logger.debug('  ADD', id)
        this.mapLayersOrdering.addLayer(layer, options)
        this.currentBackingLayers.set(id, [parentName, layer])

        this.setUpBackingLayerInteraction(prefixedID)
      }
    }
  }

  private ensurePolygonSources(remainingSourceIDs: Set<string>) {
    config.logger.debug('POLYGON SOURCES')
    config.logger.debug('polygonIDs:', Array.from(this.polygons.keys()).join(', '))

    for (const [id, [polygon]] of this.polygons) {
      const prefixedID = this.polygonSourceID(id)

      if (remainingSourceIDs.has(prefixedID)) {
        remainingSourceIDs.delete(prefixedID)
      } else {
        const source = this.buildPolySource(polygon)

        config.logger.debug('  ADD', id, `(prefixed=${prefixedID})`)
        this._map?.addSource(prefixedID, source)
      }
    }
  }

  private ensurePolygonBackingLayers(remainingLayerIDs: Set<string>) {
    config.logger.debug('POLYGON LAYERS')
    config.logger.debug('polygonIDs:', Array.from(this.polygons.keys()).join(', '))

    for (const [id, [polygon, options]] of this.polygons) {
      const fillLayer = this.buildPolyFillLayer(id, polygon)
      const lineLayer = this.buildPolyLineLayer(id, polygon)

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

  public async reloadTileLayerSource(id: string, url?: string) {
    const source = this._tileLayerSources.get(id)
    if (source == null) { return }

    config.logger.groupCollapsed("RELOAD", id, url)

    const sourceID = this.tileLayerSourceID(id)
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
      this._tileLayerSources.set(id, [url, source[1]])
    }

    if (this._map != null) {
      this.syncBackingLayers()
    }

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

    this._map.on('click', prefixedID, this.onBackingLayerClick)
    this._map.on('mouseenter', prefixedID, this.showPointerCursor)
    this._map.on('mouseleave', prefixedID, this.showDefaultCursor)
  }

  private tearDownBackingLayerInteraction(prefixedID: string) {
    if (this._map == null) { return }
    if (this._map.style == null) { return }

    this._map.off('click', prefixedID, this.onBackingLayerClick)
    this._map.off('mouseenter', prefixedID, this.showPointerCursor)
    this._map.off('mouseleave', prefixedID, this.showDefaultCursor)
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

  public tileLayerSourceID(sourceID: string) {
    return config.layerPrefix('tile') + sourceID
  }

  public polygonSourceID(sourceID: string) {
    return config.layerPrefix('polygon') + sourceID
  }

  public tileLayerBackingLayerID(layerID: string) {
    if (layerID.startsWith(config.layerPrefix('tile'))) {
      return layerID
    } else {
      return config.layerPrefix('tile') + layerID
    }
  }

  public polygonFillLayerID(layerID: string) {
    if (layerID.startsWith(config.layerPrefix('polygon'))) {
      return layerID + ':fill'
    } else {
      return config.layerPrefix('polygon') + layerID + ':fill'
    }
  }

  public polygonLineLayerID(layerID: string) {
    if (layerID.startsWith(config.layerPrefix('polygon'))) {
      return layerID + ':line'
    } else {
      return config.layerPrefix('polygon') + layerID + ':line'
    }
  }

  // #endregion

  // #region Layer groups

  private mapLayersOrdering = new MapLayersOrdering(
    () => this.mapStyle,
    () => this._map?.style.getLayersOrder() ?? [],
    (layer, insertBefore) => {
      this._map?.style.addLayer(layer, insertBefore)
    },
    id => {
      this._map?.removeLayer(id)
    }
  )

  public registerLayerGroup(name: string, ordering: LayerGroupOrdering) {
    // TODO Double rendering.
    this.mapLayersOrdering.addGroup(name, ordering)
    this.syncBackingLayers()

    return () => {
      this.mapLayersOrdering.removeGroup(name)
      this.syncBackingLayers()
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

  @queueUntil(({model}) => model.idle)
  public on(...args: any[]) {
    const map = this._map
    if (map == null) { return () => {} }

    map.on.apply(map, args as any)
    return () => {
      map?.off.apply(map, args as any)
    }
  }

  private backingLayerClickListeners = new Map<string, LayerClickListener>()

  /**
   * Adds a click event listener to a polygon.
   * 
   * @param layer The layer ID to add the listener to.
   * @param listener The click listeren.
   */
  public addPolygonClickListener(polygonID: string, listener: LayerClickListener) {
    const prefixedID = this.polygonFillLayerID(polygonID)
    return this.addBackingLayerClickListener(prefixedID, listener)
  }

  /**
   * Adds a click event listener to a TileLayer backing layer. 
   * 
   * @param layer The layer ID to add the listener to.
   * @param listener The click listeren.
   */
  public addTileBackingLayerClickListener(layerID: string, listener: LayerClickListener) {
    const prefixedID = this.tileLayerBackingLayerID(layerID)
    return this.addBackingLayerClickListener(prefixedID, listener)
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

  // #region Controls

  private controls: Array<[IControl, ControlPosition]> = []

  public addControl(control: IControl, position: ControlPosition) {
    this.controls.push([control, position])
    this.syncControls()

    return this.removeControl.bind(this, control)
  }

  public removeControl(control: IControl) {
    const index = this.controls.findIndex(it => it[0] === control)
    if (index < 0) { return }

    this.controls.splice(index, 1)
    this.syncControls()
  }

  @queueUntil(({map}) => map._controls.length > 0)
  private syncControls() {
    if (this._map == null) { return }

    for (const [control, position] of this.controls) {
      this._map.addControl(control, position)
    }
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
>

export type FitBBoxOptions = Omit<FitBoundsOptions, 'center' | 'zoom'>

interface AddBackingLayersOptions {
  group?: string
}

export type PolygonOptions = AddBackingLayersOptions
export type BackingLayerOptions = AddBackingLayersOptions

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