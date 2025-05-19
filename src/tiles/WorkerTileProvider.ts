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

  private queue:       Array<[string, Params]> = []
  private callbacks:   Map<string, RequestCallbacks[]> = new Map()
  private assignments: Map<Worker, string> = new Map()

  // #region Interface

  protected load(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<any>> {
    return new Promise((resolve, reject) => {
      // Check to see if we already have callbacks for this request. If so, it is either queued or currently
      // being processed. We can just add our callbacks to the existing ones.
      const callbacks = this.callbacks.get(params.url)
      if (callbacks != null) {
        callbacks.push([resolve, reject])
      } else {
        // This is a new request.      
        const request = this.config.request.call(this, params, abort)
        this.callbacks.set(params.url, [[resolve, reject]])
        abort.signal.addEventListener('abort', this.abortRequest.bind(this, params.url))

        this.queue.push([params.url, request])
      }

      this.next()
    })
  }

  private abortRequest(url: string) {
    // Remove from the queue if it's not assigned yet.
    const index = this.queue.findIndex(it => it[0] === url)
    if (index >= 0) { this.queue.splice(index, 1) }

    // Remove callbacks.
    this.callbacks.delete(url)

    // Find any assignment and send it an abort message.
    const assignment = Array.from(this.assignments.entries()).find(it => it[1] === url)
    if (assignment == null) { return }

    assignment[0].postMessage({
      type:    'abort',
      payload: undefined,
    })
    this.assignments.delete(assignment[0])
    this.next()
  }

  // #endregion

  // #region Queue management

  private next() {
    if (this.queue.length === 0) { return }
    
    for (const [url, params] of this.queue) {
      const worker = this.availableWorker()
      if (worker == null) { break }

      this.assign(worker, url, params)
      this.queue = this.queue.filter(it => it[0] !== url)
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

  private assign(worker: Worker, url: string, params: Params) {
    this.assignments.set(worker, url)
    worker.postMessage({
      type:    'draw',
      payload: params,
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
      const url = this.assignments.get(worker)
      if (url == null) { return }

      const callbacks = url == null ? null : this.callbacks.get(url)
      if (callbacks == null) {
        // Might have been aborted / recycled in the mean time.
        return
      } 

      handle([
        result => {
          callbacks.forEach(([resolve]) => resolve(result))
        },
        error => {
          callbacks.forEach(([_, reject]) => reject(error))
        },
      ])
    } finally {
      this.recycleWorker(worker)
      this.next()
    }
  }

  private recycleWorker(worker: Worker) {
    const url = this.assignments.get(worker)
    if (url == null) { return }

    this.assignments.delete(worker)
    this.callbacks.delete(url)
  }
  
  // #endregion

}


export interface WorkerTileProviderConfig<Req> extends TileProviderOptions {
  poolSize?: number
  request:   (this: WorkerTileProvider<Req>, request: RequestParameters, abort: AbortController) => Req
}

type RequestCallbacks = [(response: GetResourceResponse<any>) => void, (error: Error) => void]