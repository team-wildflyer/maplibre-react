import { BackingLayer, LayerGroupOrdering, MapStyleSpecification } from './types'
import { backgroundTopLayerForMapStyle } from './util'

export class MapLayersOrdering {

  constructor(
    private readonly getStyle: () => MapStyleSpecification,
    private readonly getLayers: () => string[],
    private readonly addMapLayer: (layer: BackingLayer, insertBefore?: string) => void,
    private readonly removeMapLayer: (layerID: string) => void,
  ) {}

  private layers: string[] = []

  private readonly layerGroups = new Map<string, LayerGroup>()
  private readonly unassigned: LayerGroup = {name: '$unassigned', ordering: {above: '*'}, layers: []}

  public addGroup(name: string, ordering: LayerGroupOrdering) {
    this.layerGroups.set(name, {
      name,
      ordering: ordering,
      layers:   [],
    })
  }
  
  public removeGroup(name: string) {
    this.layerGroups.delete(name)
  }

  private getGroup(name: string | '$unassigned') {
    if (name === '$unassigned') { return this.unassigned }
    const group = this.layerGroups.get(name)
    if (group != null) { return group }

    return this.unassigned
  }

  public addLayer(layer: BackingLayer, options: AddLayerOptions = {}) {
    
    const group = this.getGroup(options.group ?? '$unassigned')
    if (group == null) {
      throw new Error(`Layer group "${options.group}" not found`)
    }

    group.layers = group.layers.filter(it => it.id !== layer.id)
    group.layers.push(layer)

    this.syncLayerGroup(group)
  }

  public removeLayer(layerID: string) {
    const allGroups = [
      ...this.layerGroups.values(),
      this.unassigned,
    ]
    for (const group of allGroups) {
      const index = group.layers.findIndex(it => it.id === layerID)
      if (index === -1) { continue }

      group.layers = group.layers.filter(it => it.id !== layerID)
      break
    }

    this.removeMapLayer(layerID)
  }

  private syncLayerGroup(group: LayerGroup) {
    this.layers = this.getLayers()

    const bounds = this.getGroupBounds(group)

    // Regardless of where the group is placed, new layers are always appended to the end of the group.
    const insertionIndex = bounds[1]

    for (const layer of group.layers) {
      if (this.layers.includes(layer.id)) { continue }

      const insertBefore = this.layers[insertionIndex]
      try {
        this.addMapLayer(layer, insertBefore)
      } catch (error) {
        console.warn(error)
      }
    }
  }

  private getGroupBounds(group: LayerGroup, seen: Set<string> = new Set(), cache: Map<string, [number, number]> = new Map()): [number, number] {
    const cached = cache.get(group.name)
    if (cached != null) { return cached }

    if (seen.has(group.name)) {
      throw new Error(`Circular layer group reference: ${[...seen, group.name].join(' -> ')}`)
    }
    seen.add(group.name)

    const indexes = group.layers.map(it => this.layers.indexOf(it.id)).filter(it => it !== -1)

    if (indexes.length > 0) {
      // There are already layers in this group. Use the min and max indices of the layers in the group.
      const bounds: [number, number] = [
        Math.min(...indexes),
        Math.max(...indexes) + 1,
      ]
      cache.set(group.name, bounds)
      return bounds
    }

    // This is the first layer to be inserted into the group. Resolve the insertion point.
    const index = this.resolveNewGroupInsertionIndex(group, seen, cache)

    cache.set(group.name, [index, index])
    return [index, index]
  }

  private resolveNewGroupInsertionIndex(group: LayerGroup, seen: Set<string>, cache: Map<string, [number, number]>): number {
    const direction = 'above' in group.ordering ? 'above' : 'below'
    const reference = 'above' in group.ordering ? group.ordering.above : group.ordering.below

    if (reference === '*') {
      return direction === 'above' ? this.layers.length : 0
    } else if (reference.startsWith('group:')) {
      const refGroup = this.getGroup(reference.slice(6))
      if (refGroup == null) {
        throw new Error(`Layer group "${reference}" not found`)
      }

      const bounds = this.getGroupBounds(refGroup, seen, cache)
      return direction === 'above' ? bounds[1] : bounds[0]
    } else {
      const layerName = reference === '$background'
        ? backgroundTopLayerForMapStyle(this.getStyle()) ?? reference
        : reference

        
      const refindex = this.layers.indexOf(layerName)
      if (refindex !== -1) {
        return direction === 'above' ? refindex + 1 : refindex
      } else {
        return direction === 'above' ? this.layers.length : 0
      }
    }

  }

  // #endregion

}

export interface LayerGroup {
  name:     string
  ordering: LayerGroupOrdering
  layers:   BackingLayer[]
}

export interface AddLayerOptions {
  group?: string
}