/// <reference lib="webworker" />
import { Unzip, UnzipInflate } from 'fflate'
import { initialScanState, scanChunk } from './healthScanner'
import type { SleepInterval } from '../lib/sleep'

/**
 * Streams an Apple Health export (.zip or bare export.xml) and posts back the
 * sleep records. Nothing is fully materialized: the zip inflates in chunks
 * and the XML scanner works chunk-to-chunk.
 *
 * Messages out:
 *   { kind: 'progress', bytesRead, totalBytes }
 *   { kind: 'done', records: SleepInterval[] }
 *   { kind: 'error', message: string }
 */

interface StartMessage {
  file: File
}

const PROGRESS_EVERY = 4 * 1024 * 1024

const decoder = new TextDecoder()

self.onmessage = async (e: MessageEvent<StartMessage>) => {
  const { file } = e.data
  try {
    const records: SleepInterval[] = []
    let scan = initialScanState()
    let bytesRead = 0
    let lastReport = 0

    const feed = (bytes: Uint8Array) => {
      const result = scanChunk(scan, decoder.decode(bytes, { stream: true }))
      scan = result.state
      records.push(...result.records)
    }

    const report = () => {
      if (bytesRead - lastReport >= PROGRESS_EVERY) {
        lastReport = bytesRead
        self.postMessage({ kind: 'progress', bytesRead, totalBytes: file.size })
      }
    }

    const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip'

    if (isZip) {
      await new Promise<void>((resolve, reject) => {
        const unzip = new Unzip((f) => {
          if (!/export\.xml$/i.test(f.name) || /export_cda/i.test(f.name)) return
          f.ondata = (err, data, final) => {
            if (err) return reject(err)
            feed(data)
            if (final) resolve()
          }
          f.start()
        })
        unzip.register(UnzipInflate)

        const reader = (file.stream() as ReadableStream<Uint8Array>).getReader()
        let sawEntry = false
        const pump = (): void => {
          void reader.read().then(({ done, value }) => {
            if (value) {
              bytesRead += value.byteLength
              report()
              unzip.push(value, done)
              sawEntry = true
            }
            if (done) {
              if (value === undefined) unzip.push(new Uint8Array(0), true)
              if (!sawEntry) reject(new Error('empty zip'))
              // resolve() comes from the entry's final chunk.
              return
            }
            pump()
          }, reject)
        }
        pump()
      })
    } else {
      const reader = (file.stream() as ReadableStream<Uint8Array>).getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (value) {
          bytesRead += value.byteLength
          report()
          feed(value)
        }
        if (done) break
      }
    }

    self.postMessage({ kind: 'done', records })
  } catch (err) {
    self.postMessage({
      kind: 'error',
      message:
        'Could not read that file. Export from the Health app profile page ' +
        `("Export All Health Data") and pick the resulting zip. (${String(err)})`,
    })
  }
}
