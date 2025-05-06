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

export interface PolygonConfig {
  geometry:     Geometry
  color?:       string
  fillOpacity?: number
  lineOpacity?: number
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