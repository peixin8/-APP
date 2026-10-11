import { describe, expect, it, vi } from 'vitest'
import { emptyAppData } from '../domain/types'
import { clearSavedDirectoryHandle, connectDataDirectory, createBackupInDirectory, exportBackup, getSavedDirectoryHandle, importBackup, readDataFile, saveDirectoryHandle, writeDataFile } from './fileStore'

function fakeFileHandle(name = 'muzi-app-data.json', initial = '') {
  let contents = initial
  const handle = {
    name,
    getFile: vi.fn(async () => new File([contents], name, { type: 'application/json' })),
    createWritable: vi.fn(async () => ({
      write: vi.fn(async (value: string) => { contents = value }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    })),
    get contents() { return contents },
  }
  return handle as unknown as FileSystemFileHandle & { contents: string }
}

describe('local JSON file storage', () => {
  it('writes valid JSON and reads it back', async () => {
    const handle = fakeFileHandle()
    const data = emptyAppData()
    data.memos.push({ id: 'memo-1', content: '保存后仍在', createdAt: '2026-01-01', updatedAt: '2026-01-01' })
    await writeDataFile(handle, data)
    expect(JSON.parse(handle.contents).memos[0].content).toBe('保存后仍在')
    expect(await readDataFile(handle)).toEqual(data)
  })

  it('rejects invalid data before writing', async () => {
    const handle = fakeFileHandle()
    await expect(writeDataFile(handle, { version: 99 } as never)).rejects.toThrow()
    expect(handle.createWritable).not.toHaveBeenCalled()
  })

  it('connects a chosen empty directory by creating the primary data file', async () => {
    const primary = fakeFileHandle()
    let exists = false
    const directory = {
      queryPermission: vi.fn(async () => 'granted'),
      getFileHandle: vi.fn(async (_name: string, options?: { create?: boolean }) => {
        if (!exists && !options?.create) throw new DOMException('missing', 'NotFoundError')
        exists = true
        return primary
      }),
    }
    const target = { showDirectoryPicker: vi.fn(async () => directory) } as unknown as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
    const result = await connectDataDirectory(target)
    expect(target.showDirectoryPicker).toHaveBeenCalledOnce()
    expect(result.isNew).toBe(true)
    expect(JSON.parse(primary.contents).schemaVersion).toBe(1)
  })

  it('exports and imports a validated backup', async () => {
    const data = emptyAppData()
    data.todos.push({ id: 'todo-1', title: '完成计划', date: '2026-10-12', recurrence: 'none', completed: false, completedDates: [], note: '', createdAt: '2026-10-12', updatedAt: '2026-10-12' })
    const imported = await importBackup(new File([exportBackup(data)], 'backup.json'))
    expect(imported).toEqual(data)
  })

  it('writes a timestamped backup in the selected directory', async () => {
    const created: Array<ReturnType<typeof fakeFileHandle>> = []
    const directory = { getFileHandle: vi.fn(async (name: string) => { const handle = fakeFileHandle(name); created.push(handle); return handle }) } as unknown as FileSystemDirectoryHandle
    const name = await createBackupInDirectory(directory, emptyAppData())
    expect(name).toMatch(/^muzi-app-backup-.*\.json$/)
    expect(JSON.parse(created[0].contents).schemaVersion).toBe(1)
  })

  it('remembers the selected directory handle in IndexedDB and can clear it', async () => {
    const directory = { name: '木子APP' } as FileSystemDirectoryHandle
    await saveDirectoryHandle(directory)
    expect(await getSavedDirectoryHandle()).toEqual(directory)
    await clearSavedDirectoryHandle()
    expect(await getSavedDirectoryHandle()).toBeNull()
  })
})
