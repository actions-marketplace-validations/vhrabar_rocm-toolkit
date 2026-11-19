import { jest } from '@jest/globals'

const execMock = {
  exec: jest.fn<(cmd: string, args?: string[]) => Promise<number>>()
}
const ioMock = {
  which: jest.fn<(tool: string, check?: boolean) => Promise<string>>()
}
jest.unstable_mockModule('@actions/exec', () => execMock)
jest.unstable_mockModule('@actions/io', () => ioMock)

const { asRoot, resolveElevation } = await import('../../src/linux/root.js')

describe('resolveElevation / asRoot', () => {
  const getuid = jest.spyOn(process, 'getuid')

  beforeEach(() => {
    execMock.exec.mockResolvedValue(0)
  })

  afterAll(() => {
    getuid.mockRestore()
  })

  it('runs directly when already root, without looking for sudo', async () => {
    getuid.mockReturnValue(0)
    ioMock.which.mockResolvedValue('')
    await expect(resolveElevation()).resolves.toBe('direct')
    await asRoot(['apt-get', 'update'])
    expect(execMock.exec).toHaveBeenCalledWith('apt-get', ['update'])
    expect(ioMock.which).not.toHaveBeenCalled()
  })

  it('uses sudo when not root and sudo is available', async () => {
    getuid.mockReturnValue(1001)
    ioMock.which.mockResolvedValue('/usr/bin/sudo')
    await expect(resolveElevation()).resolves.toBe('sudo')
    await asRoot(['apt-get', 'update'])
    expect(execMock.exec).toHaveBeenCalledWith('sudo', ['apt-get', 'update'])
  })

  it('fails clearly when not root and sudo is missing', async () => {
    getuid.mockReturnValue(1001)
    ioMock.which.mockResolvedValue('')
    await expect(asRoot(['apt-get', 'update'])).rejects.toThrow(
      /needs root privileges.*sudo/
    )
    expect(execMock.exec).not.toHaveBeenCalled()
  })
})
