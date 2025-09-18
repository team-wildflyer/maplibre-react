import { MapGeoJSONFeature, MapMouseEvent } from '@maptiler/sdk'

export interface TileLayerCommonProps {
  source?:      string
  sourceLayer?: string

  onClick?: (event: MapMouseEvent, feature?: MapGeoJSONFeature) => void
}