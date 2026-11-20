import { jest } from '@jest/globals'
import { PassThrough, Readable } from 'node:stream'

export interface FakeFetcher {
  fetcher: {
    get: jest.Mock<(url: string) => Promise<Readable>>
    spawnTar: jest.Mock<
      (args: string[]) => { stdin: PassThrough; done: Promise<void> }
    >
  }
  received: Buffer[]
  calls: { url?: string; args?: string[] }
}

export function fakeFetcher(options: {
  body?: Readable
  tarExit?: 'ok' | 'fail'
}): FakeFetcher {
  const received: Buffer[] = []
  const stdin = new PassThrough()
  stdin.on('data', (chunk: Buffer) => received.push(chunk))
  const calls: { url?: string; args?: string[] } = {}
  const fetcher = {
    get: jest.fn(async (url: string) => {
      calls.url = url
      return options.body ?? Readable.from([Buffer.from('tar-bytes')])
    }),
    spawnTar: jest.fn((args: string[]) => {
      calls.args = args
      const done = new Promise<void>((resolve, reject) => {
        stdin.on('end', () =>
          options.tarExit === 'fail'
            ? reject(new Error('tar exited with code 1'))
            : resolve()
        )
      })
      return { stdin, done }
    })
  }
  return { fetcher, received, calls }
}
