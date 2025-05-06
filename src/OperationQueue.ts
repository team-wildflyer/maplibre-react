import * as maptilersdk from '@maptiler/sdk'
import { AnyFunction } from 'ytil'
import { MapModel } from './MapModel'

/**
 * Some (read: many) operations on the map need specific preconditions to be met before they can be executed.
 * This queue, in combination with the `@queueUntil()` decorator takes care of this.
 * 
 */
export class OperationQueue {

  constructor(
    private readonly map: MapModel
  ) {}
 
  private initializationQueue: Operation<any>[] = []
 
  public add<A extends any[]>(condition: OperationCondition<A>, fn: OperationFunction<A>, args: A) {
    if (this.conditionMatches(condition, args)) {
      fn.call(this.map, ...args)
    } else {
      this.initializationQueue.push([condition, fn, args])
    }
  }
 
  public flush() {
    if (this.map.map == null) { return }
 
    const nextQueue: Operation<any>[] = []
    for (const [condition, fn, args] of this.initializationQueue) {
      if (this.conditionMatches(condition, args)) {
        fn.call(this.map, ...args)
      } else {
        nextQueue.push([condition, fn, args])
      }
    }
    this.initializationQueue = nextQueue
  }
 
  private conditionMatches<A extends any[]>(condition: OperationCondition<A>, args: A) {
    if (this.map.map == null) { return false }
 
    if (typeof condition === 'string') {
      return this.map.status === condition
    } else {
      return condition.call(this, {
        model: this.map,
        map:   this.map.map, 
        args,
      })
    }
  }
  

}

export function queueUntil<A extends any[]>(condition: OperationCondition<A>) {
  return (_target: MapModel, _key: string | number | symbol, descriptor: PropertyDescriptor) => {
    const original: AnyFunction = descriptor.value as AnyFunction
    if (original == null) { return descriptor }

    return {
      ...descriptor,
      value: function (this: MapModel, ...args: A) {
        this.operationQueue.add<A>(condition, original, args)
      },
    } as PropertyDescriptor
  }
}

export type Operation<A extends any[]> = [OperationCondition<A>, OperationFunction<A>, A]
export type OperationCondition<A extends any[]> = (args: {model: MapModel, map: maptilersdk.Map, args: A}) => boolean
export type OperationFunction<A extends any[]> = (this: MapModel, ...args: A) => void

