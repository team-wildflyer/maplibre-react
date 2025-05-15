import { GetResourceResponse, RequestParameters } from '@maptiler/sdk'
import { range } from 'lodash'
import { TileProvider, TileProviderOptions } from './TileProvider'

export class WorkerTileProvider<Params> extends TileProvider {

  constructor(
    protocol: string,
    private readonly entry: string,
    private readonly config: WorkerTileProviderConfig<Params>,
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

  private workers: Worker[]

  private queue:       Params[] = []
  private callbacks:   Map<Params, RequestCallbacks> = new Map()
  private assignments: Map<Worker, Params> = new Map()

  // #region Interface

  protected load(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<any>> {
    return new Promise((resolve, reject) => {
      const request = this.config.request.call(this, params, abort)
      this.callbacks.set(request, [resolve, reject])
      abort.signal.addEventListener('abort', this.abortRequest.bind(this, request))

      this.queue.push(request)
      this.next()
    })
  }

  private abortRequest(request: Params) {
    // Remove from the queue if it's not assigned yet.
    const index = this.queue.indexOf(request)
    if (index >= 0) { this.queue.splice(index, 1) }

    // Remove callbacks.
    this.callbacks.delete(request)

    // Find any assignment and send it an abort message.
    const assignment = Array.from(this.assignments.entries()).find(it => it[1] === request)
    if (assignment == null) { return }

    assignment[0].postMessage({
      type:    'abort',
      payload: undefined,
    })
  }

  // #endregion

  // #region Queue management

  private next() {
    if (this.queue.length === 0) { return }
    
    // 1. Assign all open request to available workers.
    for (const request of this.queue) {
      const worker = this.availableWorker()
      if (worker == null) { break }

      this.assign(request, worker)
      this.queue = this.queue.filter(it => it !== request)
    }
  }

  private availableWorker() {
    for (const worker of this.workers) {
      if (!this.assignments.has(worker)) {
        return worker
      }
    }

    return null
  }

  private assign(request: Params, worker: Worker) {
    this.assignments.set(worker, request)
    worker.postMessage({
      type:    'draw',
      payload: request,
    })
  }

  // #endregion

  // #region Worker events

  private onWorkerMessage = (event: MessageEvent) => {
    const {type, payload} = event.data as {type: string, payload: any}
    switch (type) {
    case 'result':
      return this.handleWorkerResult(event, callbacks => callbacks[0](payload))
    }
  }

  private onWorkerError = (event: ErrorEvent) => {
    const worker = event.currentTarget as Worker
    if (!(worker instanceof Worker)) { return }

    this.recycleWorker(worker)
    this.next()
  }

  private onWorkerMessageError = (event: MessageEvent) => {
    this.handleWorkerResult(event, callbacks => {
      callbacks[1](new Error("Worker message serialization error"))
    })
  }

  private handleWorkerResult(event: {currentTarget: any}, handle: (callbacks: RequestCallbacks) => void) {
    const worker = event.currentTarget as Worker
    if (!(worker instanceof Worker)) { 
      throw new Error("Invalid worker instance")
    }

    try {
      const request = this.assignments.get(worker)
      const callbacks = request == null ? null : this.callbacks.get(request)
      if (callbacks == null) {
        // Might have been aborted / recycled in the mean time.
        return
      } 

      handle(callbacks)
    } finally {
      this.recycleWorker(worker)
      this.next()
    }
  }

  private recycleWorker(worker: Worker) {
    const request = this.assignments.get(worker)
    if (request == null) { return }

    this.assignments.delete(worker)
    this.callbacks.delete(request)
  }
  
  // #endregion

}


export interface WorkerTileProviderConfig<Req> extends TileProviderOptions {
  poolSize?: number
  request:   (this: WorkerTileProvider<Req>, request: RequestParameters, abort: AbortController) => Req
}

type RequestCallbacks = [(response: GetResourceResponse<any>) => void, (error: Error) => void]