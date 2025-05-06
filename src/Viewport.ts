import { LngLatBounds } from '@maptiler/sdk'
import { Point } from 'geojson'
import { BBox, Coordinate, Geometry } from 'geojson-classes'
import { isPlainObject } from 'lodash'

export class Viewport {

  constructor(
    public bbox: BBox
  ) {}

  public static world(): Viewport {
    return new Viewport(new BBox([
      -83.0348038982939,
      -49.59094837608512,
      84.89115767936102,
      54.4105319327216,
    ]))
  }

  public static from(input: ViewportLike): Viewport {
    if (input instanceof Viewport) {
      return input
    } else if (isPlainObject(input) && 'center' in input && 'zoom' in input) {
      return Viewport.fromCenterAndZoom(input.center, input.zoom)
    } else {
      return Viewport.fromBBox(input as BBox | GeoJSON.BBox)
    }
  } 

  public static fromBBox(bbox: BBox | GeoJSON.BBox): Viewport {
    return new Viewport(BBox.from(bbox))
  }

  public static fromCenterAndZoom(center: Geometry<Point> | Point | Coordinate, zoom: number): Viewport {
    const centerCoords = Geometry.point(center).coordinates
    const scale = Math.pow(2, zoom)
    const halfWidth = 180 / scale
    const halfHeight = 85.0511287798066 / scale

    return new Viewport(new BBox([
      centerCoords[0] - halfWidth,
      centerCoords[1] - halfHeight,
      centerCoords[0] + halfWidth,
      centerCoords[1] + halfHeight,
    ]))
  }

  public get bounds() {
    return new LngLatBounds(this.bbox.bbox)
  }

}

export type ViewportLike = BBox | GeoJSON.BBox | Viewport | CenterAndZoom
export interface CenterAndZoom {
  center: Geometry<GeoJSON.Point> | GeoJSON.Point | Coordinate
  zoom:   number
}
