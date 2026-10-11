import { emptyAppData, type AppData } from '../domain/types'
import { parseAppData, validateAppData } from '../domain/validation'

export const DATA_FILE_NAME = 'muzi-app-data.json'
export const BACKUP_PREFIX = 'muzi-app-backup'

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; startIn?: 'desktop' | 'documents' }) => Promise<FileSystemDirectoryHandle>
  showOpenFilePicker?: (options?: { types?: { description?: string; accept: Record<string, string[]> }[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: { suggestedName?: string; types?: { description?: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle>
}

export interface FileConnection {
  directory: FileSystemDirectoryHandle
  file: FileSystemFileHandle
  data: AppData
  isNew: boolean
}

export function supportsDirectoryAccess(target: PickerWindow = window as PickerWindow) {
  return typeof target.showDirectoryPicker === 'function'
}

export async function queryWritePermission(handle: FileSystemHandle) {
  const permissionHandle = handle as FileSystemHandle & {
    queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  }
  if (!permissionHandle.queryPermission) return false
  return await permissionHandle.queryPermission({ mode: 'readwrite' }) === 'granted'
}

export async function requestWritePermission(handle: FileSystemHandle) {
  const permissionHandle = handle as FileSystemHandle & {
    requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  }
  if (!permissionHandle.requestPermission) return false
  return await permissionHandle.requestPermission({ mode: 'readwrite' }) === 'granted'
}

export async function readDataFile(fileHandle: FileSystemFileHandle): Promise<AppData> {
  const file = await fileHandle.getFile()
  if (file.size === 0) return emptyAppData()
  return parseAppData(await file.text())
}

export async function writeDataFile(fileHandle: FileSystemFileHandle, data: AppData) {
  const safeData = validateAppData(data)
  const writable = await fileHandle.createWritable({ keepExistingData: false })
  try {
    await writable.write(`${JSON.stringify(safeData, null, 2)}\n`)
    await writable.close()
  } catch (error) {
    await writable.abort?.().catch(() => undefined)
    throw error
  }
}

export async function connectDataDirectory(target: PickerWindow = window as PickerWindow): Promise<FileConnection> {
  if (!target.showDirectoryPicker) throw new Error('当前浏览器不支持目录读写，请使用 Edge 或 Chrome，或改用手动导入/导出。')
  const directory = await target.showDirectoryPicker({ mode: 'readwrite', startIn: 'desktop' })
  if (!await queryWritePermission(directory) && !await requestWritePermission(directory)) throw new Error('未获得数据目录读写权限。请重新连接并允许访问。')
  const existed = (await directory.getFileHandle(DATA_FILE_NAME).then(() => true).catch(() => false))
  const file = await directory.getFileHandle(DATA_FILE_NAME, { create: true })
  const fileData = await file.getFile()
  const data = fileData.size === 0 ? emptyAppData() : await readDataFile(file)
  if (!existed || fileData.size === 0) await writeDataFile(file, data)
  return { directory, file, data, isNew: !existed || fileData.size === 0 }
}

const DB_NAME = 'muzi-work-life-app'
const STORE_NAME = 'connections'
const HANDLE_KEY = 'primary-directory'

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开本地连接记录。'))
  })
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法记住数据目录。'))
      transaction.onabort = () => reject(transaction.error ?? new Error('保存目录连接已取消。'))
    })
  } finally {
    db.close()
  }
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(HANDLE_KEY)
      request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('无法读取保存的数据目录。'))
    })
  } finally {
    db.close()
  }
}

export async function clearSavedDirectoryHandle(): Promise<void> {
  const db = await openHandleDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(HANDLE_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法移除本地目录连接。'))
    })
  } finally {
    db.close()
  }
}

export async function reopenConnection(directory: FileSystemDirectoryHandle): Promise<FileConnection> {
  if (!await queryWritePermission(directory)) throw new Error('需要重新授权数据目录。')
  const file = await directory.getFileHandle(DATA_FILE_NAME)
  const data = await readDataFile(file)
  return { directory, file, data, isNew: false }
}

export async function importBackup(file: File): Promise<AppData> {
  return parseAppData(await file.text())
}

export function exportBackup(data: AppData): Blob {
  const safeData = validateAppData(data)
  return new Blob([`${JSON.stringify(safeData, null, 2)}\n`], { type: 'application/json' })
}

export function downloadBackup(data: AppData) {
  const day = new Date().toISOString().slice(0, 10)
  const url = URL.createObjectURL(exportBackup(data))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${BACKUP_PREFIX}-${day}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function createBackupInDirectory(directory: FileSystemDirectoryHandle, data: AppData) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupHandle = await directory.getFileHandle(`${BACKUP_PREFIX}-${stamp}.json`, { create: true })
  await writeDataFile(backupHandle, data)
  return backupHandle.name
}
