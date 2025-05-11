import { LngLatBounds } from '@maptiler/sdk'
import { Point } from 'geojson'
import { BBox, Coordinate, Geometry } from 'geojson-classes'
import { isArray, isPlainObject } from 'lodash'
import { Size } from 'ytil'

export class Viewport {

  private constructor(
    public params: ViewportParams
  ) {}

  public static world(): Viewport {
    return new Viewport({
      bbox: new BBox([
        -83.0348038982939,
        -49.59094837608512,
        84.89115767936102,
        54.4105319327216,
      ]),
    })
  }

  public static from(input: ViewportLike): Viewport {
    if (input instanceof Viewport) {
      return input
    } else if (isPlainObject(input) && 'center' in input && 'zoom' in input) {
      return new Viewport({
        center: isArray(input.center) ? Geometry.point(input.center) : Geometry.from(input.center),
        zoom:   input.zoom,
      })
    } else {
      return new Viewport({
        bbox: BBox.from(input as BBox | GeoJSON.BBox),
      })
    }
  } 

  public static fromBBox(bbox: BBox | GeoJSON.BBox): Viewport {
    return new Viewport({
      bbox: BBox.from(bbox),
    })
  }

  public bbox(mapSize: Size): BBox {
    if ('bbox' in this.params) {
      return this.params.bbox
    }

    const zoom = this.params.zoom
    const [lon, lat] = this.params.center.coordinates

    const lonMin = lon - (mapSize.width / 2) / Math.pow(2, zoom)
    const latMin = lat - (mapSize.height / 2) / Math.pow(2, zoom)
    const lonMax = lon + (mapSize.width / 2) / Math.pow(2, zoom)
    const latMax = lat + (mapSize.height / 2) / Math.pow(2, zoom)

    return new BBox([lonMin, latMin, lonMax, latMax])
  }

  public bounds(mapSize: Size) {
    return new LngLatBounds(this.bbox(mapSize).bbox)
  }

  public equals(other: Viewport) {
    if ('bbox' in this.params) {
      if (!('bbox' in other.params)) { return false }
      return this.params.bbox.equals(other.params.bbox)
    } else {
      if (!('center' in other.params)) { return false }
      if (this.params.zoom !== other.params.zoom) { return false }
      if (!this.params.center.equals(other.params.center)) { return false }
      return true
    }
  }

}

type ViewportParams = {
  bbox: BBox
} | {
  center: Geometry<Point>
  zoom:   number
}

export type ViewportLike = BBox | GeoJSON.BBox | Viewport | CenterAndZoom
export interface CenterAndZoom {
  center: Geometry<GeoJSON.Point> | GeoJSON.Point | Coordinate
  zoom:   number
}
