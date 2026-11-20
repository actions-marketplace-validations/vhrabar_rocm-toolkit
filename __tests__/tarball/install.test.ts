import { jest } from '@jest/globals'
import * as path from 'node:path'
import { fakeFetcher } from '../helpers/fake-fetcher.js'

const core = { startGroup: jest.fn(), endGroup: jest.fn(), info: jest.fn() }
const fsMock = {
  existsSync: jest.fn<(p: string) => boolean>(),
  readFileSync: jest.fn<(p: string, enc: string) => string>(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  rmSync: jest.fn()
}
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('node:fs', () => ({ ...fsMock, default: fsMock }))

const { installTarball } = await import('../../src/tarball/install.js')

// The Windows tests cover the same logic with path.win32; this pins POSIX.
const PREFIX = '/opt/rocm/core-10.1'
const target = {
  url: 'https://example.test/therock-dist-linux-gfx120X-all-10.1.0.tar.gz',
  prefix: PREFIX,
  hipcc: `${PREFIX}/bin/hipcc`,
  stamp: 'gfx120X-all 10.1.0',
  join: path.posix.join
}

describe('installTarball', () => {
  it('extracts into the prefix and writes the marker next to it', async () => {
    let extracted = false
    fsMock.existsSync.mockImplementation((p) => p === target.hipcc && extracted)
    const { fetcher, calls } = fakeFetcher({})
    fetcher.spawnTar.mockImplementationOnce((args) => {
      extracted = true
      calls.args = args
      return fakeFetcher({}).fetcher.spawnTar(args)
    })
    await installTarball(target, fetcher)
    expect(calls.url).toBe(target.url)
    expect(calls.args).toEqual(['-xzf', '-', '-C', PREFIX])
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(PREFIX, { recursive: true })
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      `${PREFIX}/.setup-rocm`,
      'gfx120X-all 10.1.0\n'
    )
  })

  it('keeps an install with the same stamp', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('gfx120X-all 10.1.0\n')
    const { fetcher } = fakeFetcher({})
    await installTarball(target, fetcher)
    expect(fetcher.get).not.toHaveBeenCalled()
    expect(fsMock.rmSync).not.toHaveBeenCalled()
  })

  it('replaces an install with a different stamp', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('gfx110X-all 10.1.0\n')
    const { fetcher } = fakeFetcher({})
    await installTarball(target, fetcher)
    expect(fsMock.rmSync).toHaveBeenCalledWith(PREFIX, {
      recursive: true,
      force: true
    })
    expect(fetcher.get).toHaveBeenCalledWith(target.url)
  })

  it('fails when hipcc is missing after extraction', async () => {
    fsMock.existsSync.mockReturnValue(false)
    const { fetcher } = fakeFetcher({})
    await expect(installTarball(target, fetcher)).rejects.toThrow(
      /\/opt\/rocm\/core-10\.1\/bin\/hipcc does not exist/
    )
    expect(fsMock.writeFileSync).not.toHaveBeenCalled()
  })
})
