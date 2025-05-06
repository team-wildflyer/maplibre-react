import { MapStyle } from '@maptiler/sdk'
import { MapStyleSpecification } from './types'

export function backgroundTopLayerForMapStyle(mapStyle: MapStyleSpecification) {
  if (mapStyle === MapStyle.OPENSTREETMAP.DEFAULT) {
    return 'Disputed border'
  } else {
    return 'Country border'
  }
}