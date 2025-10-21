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

  protected load({url}: RequestParameters, abort: AbortController): Promise<GetResourceResponse<ArrayBuffer>> {
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
    worker?.postMessage({type: 'draw:abort'})
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
      const worker = this.assignToFreeWorker(request)
      if (worker == null) { break }

      assigned.push(request.uid)
      worker.postMessage({
        type:    'draw', 
        payload: {url: request.url},
      })
    }

    // Remove the assigned URLs from the pending list.
    this.pending = this.pending.filter(it => !assigned.includes(it.uid))
  }

  private assignToFreeWorker(request: DrawRequest) {
    const worker = this.workers.find(it => !this.assigned.has(it))
    if (worker == null) { return null }
    this.assigned.set(worker, request)
    return worker
  }

  // #endregion

  // #region Worker events

  private onWorkerMessage = (event: MessageEvent) => {
    const data = event.data as
      | {type: 'draw:result', payload: {url: string} & GetResourceResponse<ArrayBuffer>}
      | {type: 'draw:aborted'}

    return this.handleWorkerResult(event, request => {
      // If the worker was correctly aborted, recycle the worker.
      if (data.type === 'draw:aborted') { return }

      // If the worker failed to abort, it may still respond with the incorrect URL. Ignore this.
      if (request.url !== data.payload.url) { return }

      // Otherwise, resolve the request.
      request.resolve(data.payload)
    })
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
      this.recycleWorker(worker)
      this.next()
    }
  }

  private recycleWorker(worker: Worker) {
    this.assigned.get(worker)?.cleanup()
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
  resolve: (response: GetResourceResponse<ArrayBuffer>) => void
  reject:  (error: Error) => void
  cleanup: () => void
}