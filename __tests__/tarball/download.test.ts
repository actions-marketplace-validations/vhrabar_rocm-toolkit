import { jest } from '@jest/globals'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { fakeFetcher } from '../helpers/fake-fetcher.js'

const httpsGet =
  jest.fn<(url: string, cb: (res: unknown) => void) => EventEmitter>()
jest.unstable_mockModule('node:https', () => ({
  get: httpsGet,
  default: { get: httpsGet }
}))

const download = await import('../../src/tarball/download.js')

describe('downloadAndExtract', () => {
  it('streams the body into tar with the right arguments', async () => {
    const { fetcher, received, calls } = fakeFetcher({})
    await download.downloadAndExtract('https://x/y.tar.gz', 'C:\\dest', fetcher)
    expect(calls.url).toBe('https://x/y.tar.gz')
    expect(calls.args).toEqual(['-xzf', '-', '-C', 'C:\\dest'])
    expect(Buffer.concat(received).toString()).toBe('tar-bytes')
  })

  it('fails when tar fails', async () => {
    const { fetcher } = fakeFetcher({ tarExit: 'fail' })
    await expect(
      download.downloadAndExtract('https://x/y.tar.gz', 'C:\\dest', fetcher)
    ).rejects.toThrow(/tar exited with code 1/)
  })

  it('fails when the download breaks halfway', async () => {
    const body = new Readable({
      read(): void {
        this.destroy(new Error('connection reset'))
      }
    })
    const { fetcher } = fakeFetcher({ body })
    await expect(
      download.downloadAndExtract('https://x/y.tar.gz', 'C:\\dest', fetcher)
    ).rejects.toThrow(/connection reset/)
  })
})

function fakeResponse(status: number, location?: string): Readable {
  const res = Readable.from([]) as Readable & {
    statusCode: number
    headers: Record<string, string>
    setTimeout: jest.Mock
  }
  res.statusCode = status
  res.headers = location ? { location } : {}
  res.setTimeout = jest.fn()
  return res
}

function respondWith(...responses: Readable[]): void {
  httpsGet.mockReset()
  for (const res of responses) {
    httpsGet.mockImplementationOnce((_url, cb) => {
      queueMicrotask(() => cb(res))
      return new EventEmitter()
    })
  }
}

describe('httpGet', () => {
  it('resolves with the response on 200', async () => {
    const ok = fakeResponse(200)
    respondWith(ok)
    await expect(download.httpGet('https://x/a')).resolves.toBe(ok)
  })

  it('fails with the status code on 404', async () => {
    respondWith(fakeResponse(404))
    await expect(download.httpGet('https://x/a')).rejects.toThrow(/HTTP 404/)
  })

  it('follows a relative redirect', async () => {
    const ok = fakeResponse(200)
    respondWith(fakeResponse(302, '/b/file.tar.gz'), ok)
    await expect(download.httpGet('https://x/a')).resolves.toBe(ok)
    expect(httpsGet.mock.calls[1]?.[0]).toBe('https://x/b/file.tar.gz')
  })

  it('gives up after too many redirects', async () => {
    respondWith(
      fakeResponse(302, '/1'),
      fakeResponse(302, '/2'),
      fakeResponse(302, '/3'),
      fakeResponse(302, '/4')
    )
    await expect(download.httpGet('https://x/a')).rejects.toThrow(
      /Too many redirects/
    )
  })

  it('rejects on a connection error', async () => {
    httpsGet.mockReset()
    httpsGet.mockImplementationOnce(() => {
      const req = new EventEmitter()
      queueMicrotask(() => req.emit('error', new Error('ENOTFOUND')))
      return req
    })
    await expect(download.httpGet('https://x/a')).rejects.toThrow(/ENOTFOUND/)
  })
})
