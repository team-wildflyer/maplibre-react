import {
  CustomLayerInterface,
  FitBoundsOptions,
  LayerSpecification,
  MapStyleVariant,
  ReferenceMapStyle,
  StyleSpecification,
} from '@maptiler/sdk'
import { BBox, Geometry } from 'geojson-classes'
import { DateTime } from 'luxon'
import { DrawCombineEvent, DrawCreateEvent, DrawDeleteEvent, DrawModeChangeEvent, DrawRenderEvent, DrawSelectionChangeEvent, DrawUncombineEvent, DrawUpdateEvent } from '@mapbox/mapbox-gl-draw'

export type MapStyleSpecification = ReferenceMapStyle | MapStyleVariant | StyleSpecification | string

export type BackingLayer = CustomLayerInterface | LayerSpecification

export interface BackingLayerControl {
  setTime?(name: string, time: DateTime): void
}

export interface LayerOptions {
  control?:    BackingLayerControl
  category?:   string | null
  showInMenu?: boolean
}

export enum LineStyle {
  Solid = 'solid',
  Dashed = 'dashed',
}

export interface PolygonConfig {
  geometry: Geometry
  color?:   string
  
  fillOpacity?: number

  lineColor?:   string
  lineOpacity?: number
  lineStyle?:   LineStyle
  lineWidth?:   number
  
  hover?: boolean
}

export enum MapStatus {
  Uninitialized,
  Loading,
  Loaded,
  Idle,
  Error
}

export type FitBoundsOptionsCallback = (reason: FitBoundsReason, from: BBox, to: BBox) => boolean | FitBoundsOptions
export enum FitBoundsReason {
  MapResized,
  ViewportReset,
  DefaultViewportChanged
}

export type LayerGroupOrdering = (
  | {above: LayerGroupOrderingSpecifier}
  | {below: LayerGroupOrderingSpecifier}
)

export type LayerGroupOrderingSpecifier =
  /** The layer group is above or below another group. */
  | `group:${string}`
  /** The layer group is top or bottom most. */
  | '*'
  /** The layer group is above (or below although that makes no sense) what is considered 'background' in the current map style. */
  | '$background'
  /** The layer group is above or below layer with explicit ID. */
  | string

export interface MapBoxDrawEventType {
  'draw.create':          DrawCreateEvent;
  'draw.update':          DrawUpdateEvent;
  'draw.delete':          DrawDeleteEvent;
  'draw.selectionchange': DrawSelectionChangeEvent;
  'draw.modechange':      DrawModeChangeEvent;
  'draw.render':          DrawRenderEvent;
  'draw.combine':         DrawCombineEvent;
  'draw.uncombine':       DrawUncombineEvent;
}
  