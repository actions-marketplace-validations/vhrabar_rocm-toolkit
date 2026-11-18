import { jest } from '@jest/globals'
import { EventEmitter } from 'node:events'
import { PassThrough, Readable } from 'node:stream'

const core = {
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  info: jest.fn(),
  warning: jest.fn()
}
const fsMock = {
  existsSync: jest.fn<(p: string) => boolean>(),
  readFileSync: jest.fn<(p: string, enc: string) => string>(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  rmSync: jest.fn()
}
const httpsGet =
  jest.fn<(url: string, cb: (res: unknown) => void) => EventEmitter>()
const spawnMock = jest.fn()
jest.unstable_mockModule('node:https', () => ({
  get: httpsGet,
  default: { get: httpsGet }
}))
jest.unstable_mockModule('node:child_process', () => ({
  spawn: spawnMock,
  default: { spawn: spawnMock }
}))
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('node:fs', () => ({ ...fsMock, default: fsMock }))

const windows = await import('../src/windows.js')

const PREFIX = 'C:\\rocm\\core-10.1'
const HIPCC = `${PREFIX}\\bin\\hipcc.exe`
const MARKER = `${PREFIX}\\.setup-rocm`

describe('windowsFamily', () => {
  it.each([
    [['gfx1200'], 'gfx120X-all'],
    [['gfx1201'], 'gfx120X-all'],
    [['gfx1200', 'gfx1201'], 'gfx120X-all'],
    [['gfx1100'], 'gfx110X-all'],
    [['gfx1031'], 'gfx103X-all'],
    [['gfx1010'], 'gfx101X-dgpu'],
    [['gfx1151'], 'gfx1151'],
    [['gfx90a'], 'gfx90a'],
    [['gfx908'], 'gfx908']
  ])('%j -> %s', (gfx, family) => {
    expect(windows.windowsFamily(gfx)).toBe(family)
  })

  it('uses multiarch for "all" (no targets)', () => {
    expect(windows.windowsFamily([])).toBe('multiarch')
  })

  it('uses multiarch when the targets span families', () => {
    expect(windows.windowsFamily(['gfx1100', 'gfx1200'])).toBe('multiarch')
  })

  it.each(['gfx942', 'gfx950', 'gfx1250', 'gfx9999'])(
    'rejects %s, which has no Windows build',
    (target) => {
      expect(() => windows.windowsFamily([target])).toThrow(/no Windows build/)
    }
  )
})

describe('tarballUrl / windowsPrefix', () => {
  it('builds the URL from version and family', () => {
    expect(windows.tarballUrl('10.1.0', 'gfx120X-all')).toBe(
      'https://stable.repo.amd.com/rocm/core/tarball/' +
        'therock-dist-windows-gfx120X-all-10.1.0.tar.gz'
    )
  })

  it('uses MAJOR.MINOR in the install directory', () => {
    expect(windows.windowsPrefix('10.1.0')).toBe(PREFIX)
    expect(windows.windowsPrefix('10.0.0', 'D:')).toBe('D:\\rocm\\core-10.0')
  })
})

interface FakeFetcher {
  fetcher: {
    get: jest.Mock<(url: string) => Promise<Readable>>
    spawnTar: jest.Mock<
      (args: string[]) => { stdin: PassThrough; done: Promise<void> }
    >
  }
  received: Buffer[]
  calls: { url?: string; args?: string[] }
}

function fakeFetcher(options: {
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

describe('downloadAndExtract', () => {
  it('streams the body into tar with the right arguments', async () => {
    const { fetcher, received, calls } = fakeFetcher({})
    await windows.downloadAndExtract('https://x/y.tar.gz', 'C:\\dest', fetcher)
    expect(calls.url).toBe('https://x/y.tar.gz')
    expect(calls.args).toEqual(['-xzf', '-', '-C', 'C:\\dest'])
    expect(Buffer.concat(received).toString()).toBe('tar-bytes')
  })

  it('fails when tar fails', async () => {
    const { fetcher } = fakeFetcher({ tarExit: 'fail' })
    await expect(
      windows.downloadAndExtract('https://x/y.tar.gz', 'C:\\dest', fetcher)
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
      windows.downloadAndExtract('https://x/y.tar.gz', 'C:\\dest', fetcher)
    ).rejects.toThrow(/connection reset/)
  })
})

describe('installWindows', () => {
  const inputs = {
    version: '10.1.0',
    gfx: ['gfx1200'],
    components: ['dev' as const],
    useCache: true,
    logFileSuffix: 'log.txt'
  }

  beforeEach(() => {
    process.env['SystemDrive'] = 'C:'
    fsMock.existsSync.mockReset()
    fsMock.readFileSync.mockReset()
  })

  it('downloads, extracts and writes a marker on a fresh runner', async () => {
    // Nothing exists until the extraction "creates" hipcc.exe.
    let extracted = false
    fsMock.existsSync.mockImplementation((p) => extracted && p === HIPCC)
    const { fetcher, calls } = fakeFetcher({})
    fetcher.spawnTar.mockImplementationOnce((args: string[]) => {
      calls.args = args
      extracted = true
      const stdin = new PassThrough()
      stdin.resume()
      return { stdin, done: new Promise<void>((r) => stdin.on('end', r)) }
    })
    const prefix = await windows.installWindows(inputs, fetcher)
    expect(prefix).toBe(PREFIX)
    expect(calls.url).toBe(
      'https://stable.repo.amd.com/rocm/core/tarball/' +
        'therock-dist-windows-gfx120X-all-10.1.0.tar.gz'
    )
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(PREFIX, { recursive: true })
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      MARKER,
      'gfx120X-all 10.1.0\n'
    )
    expect(fsMock.rmSync).not.toHaveBeenCalled()
  })

  it('does nothing when the same family and version are installed', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('gfx120X-all 10.1.0\n')
    const { fetcher } = fakeFetcher({})
    expect(await windows.installWindows(inputs, fetcher)).toBe(PREFIX)
    expect(fetcher.get).not.toHaveBeenCalled()
    expect(fsMock.rmSync).not.toHaveBeenCalled()
  })

  it('replaces an install of a different family', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('gfx110X-all 10.1.0\n')
    const { fetcher } = fakeFetcher({})
    fetcher.spawnTar.mockImplementationOnce(() => {
      const stdin = new PassThrough()
      stdin.resume()
      return { stdin, done: new Promise<void>((r) => stdin.on('end', r)) }
    })
    await windows.installWindows(inputs, fetcher)
    expect(fsMock.rmSync).toHaveBeenCalledWith(PREFIX, {
      recursive: true,
      force: true
    })
    expect(fetcher.get).toHaveBeenCalledTimes(1)
  })

  it('fails when hipcc.exe is missing after extraction', async () => {
    fsMock.existsSync.mockReturnValue(false)
    const { fetcher } = fakeFetcher({})
    await expect(windows.installWindows(inputs, fetcher)).rejects.toThrow(
      /hipcc\.exe does not exist/
    )
    expect(fsMock.writeFileSync).not.toHaveBeenCalled()
  })

  it('rejects an unsupported GPU target before touching the disk', async () => {
    const { fetcher } = fakeFetcher({})
    await expect(
      windows.installWindows({ ...inputs, gfx: ['gfx942'] }, fetcher)
    ).rejects.toThrow(/no Windows build/)
    expect(fsMock.mkdirSync).not.toHaveBeenCalled()
    expect(fetcher.get).not.toHaveBeenCalled()
  })

  it('warns that components has no effect', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('gfx120X-all 10.1.0\n')
    const { fetcher } = fakeFetcher({})
    await windows.installWindows(
      { ...inputs, components: ['sdk' as const] },
      fetcher
    )
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringMatching(/components/)
    )
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
    await expect(windows.httpGet('https://x/a')).resolves.toBe(ok)
  })

  it('fails with the status code on 404', async () => {
    respondWith(fakeResponse(404))
    await expect(windows.httpGet('https://x/a')).rejects.toThrow(/HTTP 404/)
  })

  it('follows a relative redirect', async () => {
    const ok = fakeResponse(200)
    respondWith(fakeResponse(302, '/b/file.tar.gz'), ok)
    await expect(windows.httpGet('https://x/a')).resolves.toBe(ok)
    expect(httpsGet.mock.calls[1]?.[0]).toBe('https://x/b/file.tar.gz')
  })

  it('gives up after too many redirects', async () => {
    respondWith(
      fakeResponse(302, '/1'),
      fakeResponse(302, '/2'),
      fakeResponse(302, '/3'),
      fakeResponse(302, '/4')
    )
    await expect(windows.httpGet('https://x/a')).rejects.toThrow(
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
    await expect(windows.httpGet('https://x/a')).rejects.toThrow(/ENOTFOUND/)
  })
})

describe('defaultFetcher.spawnTar', () => {
  function fakeChild(): EventEmitter & { stdin: PassThrough } {
    return Object.assign(new EventEmitter(), { stdin: new PassThrough() })
  }

  it('runs the Windows system tar, not whatever is first on PATH', () => {
    process.env['SystemRoot'] = 'C:\\Windows'
    const child = fakeChild()
    spawnMock.mockReturnValueOnce(child)
    windows.defaultFetcher.spawnTar(['-xzf', '-', '-C', 'C:\\dest'])
    expect(spawnMock).toHaveBeenCalledWith(
      'C:\\Windows\\System32\\tar.exe',
      ['-xzf', '-', '-C', 'C:\\dest'],
      expect.objectContaining({ stdio: ['pipe', 'inherit', 'inherit'] })
    )
  })

  it('resolves when tar exits 0 and rejects otherwise', async () => {
    const ok = fakeChild()
    spawnMock.mockReturnValueOnce(ok)
    const first = windows.defaultFetcher.spawnTar([])
    ok.emit('close', 0)
    await expect(first.done).resolves.toBeUndefined()

    const bad = fakeChild()
    spawnMock.mockReturnValueOnce(bad)
    const second = windows.defaultFetcher.spawnTar([])
    bad.emit('close', 2)
    await expect(second.done).rejects.toThrow(/tar exited with code 2/)
  })

  it('rejects when tar cannot be started', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValueOnce(child)
    const run = windows.defaultFetcher.spawnTar([])
    child.emit('error', new Error('ENOENT'))
    await expect(run.done).rejects.toThrow(/ENOENT/)
  })
})
