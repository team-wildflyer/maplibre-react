import { GetResourceResponse, RequestParameters } from '@maptiler/sdk'
import { isFunction, range } from 'lodash'
import { TileProvider, TileProviderOptions } from './TileProvider'

export class WorkerTileProvider extends TileProvider {

  constructor(
    protocol: string,
    private readonly entry: string,
    private readonly config: WorkerTileProviderOptions,
  ) {
    super(protocol, config)

    this.workers = range(config.poolSize ?? 1).map(() => {
      const worker = new Worker(this.entry, {type: 'module'})
      worker.addEventListener('message', this.onWorkerMessage)
      worker.addEventListener('messageerror', this.onWorkerMessageError)
      worker.addEventListener('error', this.onWorkerError)
      return worker
    })
  }

  private workers:  Worker[]
  private pending:  DrawRequest[] = []
  private assigned: Map<Worker, DrawRequest> = new Map()

  private nextUID: number = 0

  // #region Interface

  protected load({url}: RequestParameters, abort: AbortController): Promise<{buffer: GetResourceResponse<any>, url: string}> {
    return new Promise((resolve, reject) => {
      const uid = this.nextUID++

      // Bind the abort signal to the request.
      const onAbort = this.abortRequest.bind(this, uid)

      // Create a cleanup function to remove the abort listener.
      const cleanup = () => {
        abort.signal.removeEventListener('abort', onAbort)
      }

      // When a request is aborted, we hard-abort the request. We also send the worker an abort message, 
      // but just in case wires get crossed and/or the worker does not handle the abort message, we
      // hard-reject the request here. When cleaning up, we remove the assigned request, which results
      // in any worker rejection/resolution to be ignored later.
      abort.signal.addEventListener('abort', () => {
        cleanup()
        onAbort()
        reject(new Error("Request aborted"))
      })

      // Queue the request.
      this.pending.push({
        uid,
        url,
        resolve,
        reject,
        cleanup,
      })
      
      // If we have a worker available, assign it to this request.
      this.next()
    })
  }

  private abortRequest(uid: number) {
    // The request may still be pending, remove it from the queue.
    this.pending = this.pending.filter(it => it.uid !== uid)

    // Abort and unassign any worker if applicable.
    const worker = this.getWorkerAssignedTo(uid)
    if (worker == null) { return }

    worker.postMessage({type: 'abort'})
    this.assigned.delete(worker)

    // This may free up a worker, so we can try to process the next request.
    this.next()
  }

  private getWorkerAssignedTo(uid: number) {
    for (const entry of this.assigned.entries()) {
      if (entry[1].uid === uid) { return entry[0] }
    }

    return null
  }

  // #endregion

  // #region Other methods

  public broadcastMessage(type: string, payload: any): void
  public broadcastMessage(type: string, payload: () => {payload: any, transfer: Transferable[]}): void
  public broadcastMessage(type: string, arg: any) {
    const getPayload = () => isFunction(arg) ? arg() : {payload: arg, transfer: undefined}

    for (const worker of this.workers) {
      const {payload, transfer} = getPayload()
      worker.postMessage({type, payload}, transfer)
    }
  }

  // #endregion

  // #region Queue management

  private next() {
    if (this.pending.length === 0) { return }

    const assigned: number[] = []    
    for (const request of this.pending) {
      const worker = this.availableWorker()
      if (worker == null) { break }

      this.assignAndDraw(worker, request)
      assigned.push(request.uid)
    }

    // Remove the assigned URLs from the pending list.
    this.pending = this.pending.filter(it => !assigned.includes(it.uid))
  }

  private availableWorker() {
    for (const worker of this.workers) {
      if (!this.assigned.has(worker)) {
        return worker
      }
    }

    return null
  }

  private assignAndDraw(worker: Worker, request: DrawRequest) {
    this.assigned.set(worker, request)
    worker.postMessage({
      type:    'draw', 
      payload: request.url,
    },)
  }

  // #endregion

  // #region Worker events

  private onWorkerMessage = (event: MessageEvent) => {
    const {type, payload: {buffer, url}} = event.data as {type: string, payload: any}
    switch (type) {
    case 'result':
      return this.handleWorkerResult(event, request => {
        request.resolve({buffer, url})
      })
    }
  }

  private onWorkerError = (event: ErrorEvent) => {
    const worker = event.currentTarget as Worker
    if (!(worker instanceof Worker)) { return }

    this.recycleWorker(worker)
    this.next()
  }

  private onWorkerMessageError = (event: MessageEvent) => {
    this.handleWorkerResult(event, request => {
      request.reject(new Error("Worker message serialization error"))
    })
  }

  private handleWorkerResult(event: {currentTarget: any}, handle: (request: DrawRequest) => void) {
    const worker = event.currentTarget as Worker
    if (!(worker instanceof Worker)) { 
      throw new Error("Invalid worker instance")
    }

    // Find the request. If it had been aborted, its promise would have been rejected already, so we
    // can silently ignore this.
    const request = this.assigned.get(worker)
    if (request == null) { return }

    try {
      handle(request)
    } finally {
      request.cleanup()
      this.recycleWorker(worker)
      this.next()
    }
  }

  private recycleWorker(worker: Worker) {
    const request = this.assigned.get(worker)
    if (request == null) { return }

    this.assigned.delete(worker)
  }
  
  // #endregion

}

export interface WorkerTileProviderOptions extends TileProviderOptions {
  poolSize?: number

  init?:   (this: WorkerTileProvider) => Promise<void>
  deinit?: (this: WorkerTileProvider) => Promise<void>
}

interface DrawRequest {
  uid:     number
  url:     string
  resolve: (response: {buffer: GetResourceResponse<any>, url: string}) => void
  reject:  (error: Error) => void
  cleanup: () => void
}