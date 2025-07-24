class MaplibreCompatibleMapboxDraw extends MapboxDraw {

  onAdd(map: import('mapbox-gl').Map): HTMLElement {
    // Accepts maplibregl.Map at runtime, even though typed as mapbox-gl.Map
    return super.onAdd(map)
  }

}