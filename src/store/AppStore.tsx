/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { emptyAppData, type AppData } from '../domain/types'
import {
  clearSavedDirectoryHandle,
  connectDataDirectory,
  createBackupInDirectory,
  downloadBackup,
  getSavedDirectoryHandle,
  importBackup,
  reopenConnection,
  saveDirectoryHandle,
  supportsDirectoryAccess,
  writeDataFile,
} from '../storage/fileStore'

export type SaveState = 'checking' | 'disconnected' | 'connecting' | 'saving' | 'saved' | 'manual' | 'error'
export type StorageMode = 'file' | 'manual' | null

interface AppStoreValue {
  data: AppData | null
  saveState: SaveState
  storageMode: StorageMode
  fileName: string
  lastSavedAt: string | null
  message: string
  isPending: boolean
  supportsFileAccess: boolean
  connect: () => Promise<void>
  updateData: (recipe: (current: AppData) => AppData) => void
  removeConnection: () => Promise<void>
  importAsPrimary: (file: File) => Promise<void>
  restoreBackup: (file: File) => Promise<void>
  exportBackup: () => void
  saveNow: () => Promise<void>
}

const StoreContext = createContext<AppStoreValue | null>(null)

const friendlyError = (error: unknown) => error instanceof Error ? error.message : '发生未知错误，请重试。'

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('checking')
  const [storageMode, setStorageMode] = useState<StorageMode>(null)
  const [fileName, setFileName] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [message, setMessage] = useState('正在检查本地数据文件…')
  const [isPending, setIsPending] = useState(false)
  const dataRef = useRef<AppData | null>(null)
  const fileRef = useRef<FileSystemFileHandle | null>(null)
  const directoryRef = useRef<FileSystemDirectoryHandle | null>(null)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  const supportsFileAccess = supportsDirectoryAccess()

  const setLoadedData = useCallback((next: AppData, mode: StorageMode, file?: FileSystemFileHandle, directory?: FileSystemDirectoryHandle) => {
    dataRef.current = next
    setData(next)
    setStorageMode(mode)
    fileRef.current = file ?? null
    directoryRef.current = directory ?? null
    setFileName(file?.name ?? (mode === 'manual' ? '手动导入的数据' : ''))
  }, [])

  useEffect(() => {
    let active = true
    const restore = async () => {
      if (!supportsDirectoryAccess()) {
        if (active) {
          setSaveState('disconnected')
          setMessage('当前浏览器不支持目录读写，可导入数据文件开始使用。')
        }
        return
      }
      try {
        const saved = await getSavedDirectoryHandle()
        if (!saved) {
          if (active) {
            setSaveState('disconnected')
            setMessage('请连接本地数据目录以开始使用。')
          }
          return
        }
        const connection = await reopenConnection(saved)
        if (!active) return
        fileRef.current = connection.file
        directoryRef.current = connection.directory
        setLoadedData(connection.data, 'file', connection.file, connection.directory)
        setSaveState('saved')
        setLastSavedAt(connection.data.updatedAt)
        setMessage('已连接本地数据文件。')
      } catch (error) {
        if (active) {
          setSaveState('disconnected')
          setMessage(friendlyError(error))
        }
      }
    }
    void restore()
    return () => { active = false }
  }, [setLoadedData])

  const connect = useCallback(async () => {
    setSaveState('connecting')
    setMessage('正在连接本地数据目录…')
    try {
      const connection = await connectDataDirectory()
      await saveDirectoryHandle(connection.directory)
      setLoadedData(connection.data, 'file', connection.file, connection.directory)
      setSaveState('saved')
      const stamp = new Date().toISOString()
      setLastSavedAt(stamp)
      setMessage(connection.isNew ? '数据文件已创建并连接。' : '本地数据文件已连接。')
    } catch (error) {
      setSaveState('disconnected')
      setMessage(friendlyError(error))
    }
  }, [setLoadedData])

  const updateData = useCallback((recipe: (current: AppData) => AppData) => {
    const current = dataRef.current
    if (!current) return
    const next = recipe(current)
    next.updatedAt = new Date().toISOString()
    dataRef.current = next
    setData(next)
    if (storageMode !== 'file' || !fileRef.current) {
      setSaveState('manual')
      setMessage('修改尚未导出；请在“数据与设置”中保存备份文件。')
      return
    }
    const currentHandle = fileRef.current
    setSaveState('saving')
    setMessage('正在保存…')
    setIsPending(true)
    writeQueue.current = writeQueue.current.catch(() => undefined).then(() => writeDataFile(currentHandle, next)).then(() => {
      if (dataRef.current?.updatedAt === next.updatedAt) {
        setSaveState('saved')
        setLastSavedAt(new Date().toISOString())
        setMessage('所有更改已保存。')
      }
    }).catch((error: unknown) => {
      setSaveState('error')
      setMessage(`保存失败：${friendlyError(error)} 当前内容仍保留在页面中，请重试或导出备份。`)
    }).finally(() => setIsPending(false))
  }, [storageMode])

  const removeConnection = useCallback(async () => {
    await clearSavedDirectoryHandle()
    dataRef.current = null
    fileRef.current = null
    directoryRef.current = null
    setData(null)
    setStorageMode(null)
    setFileName('')
    setLastSavedAt(null)
    setSaveState('disconnected')
    setMessage('已断开数据目录连接。')
  }, [])

  const importAsPrimary = useCallback(async (file: File) => {
    try {
      const next = await importBackup(file)
      setLoadedData(next, 'manual')
      setSaveState('manual')
      setMessage('数据已导入到当前会话；请导出备份以保存到电脑。')
    } catch (error) {
      throw new Error(friendlyError(error))
    }
  }, [setLoadedData])

  const restoreBackup = useCallback(async (file: File) => {
    const next = await importBackup(file)
    const current = dataRef.current
    const directory = directoryRef.current
    const handle = fileRef.current
    if (current && directory && handle) {
      await createBackupInDirectory(directory, current)
      await writeDataFile(handle, next)
      setLoadedData(next, 'file', handle, directory)
      setSaveState('saved')
      setLastSavedAt(new Date().toISOString())
      setMessage('备份已恢复，恢复前的数据已另存为备份。')
    } else {
      setLoadedData(next, 'manual')
      setSaveState('manual')
      setMessage('备份已载入当前会话；请导出文件以保存。')
    }
  }, [setLoadedData])

  const exportCurrentBackup = useCallback(() => {
    const current = dataRef.current
    if (current) downloadBackup(current)
  }, [])

  const saveNow = useCallback(async () => {
    const current = dataRef.current
    if (!current) return
    const handle = fileRef.current
    if (storageMode !== 'file' || !handle) {
      downloadBackup(current)
      setSaveState('manual')
      setMessage('备份已下载，可选择保存位置。')
      return
    }
    setSaveState('saving')
    setMessage('正在保存本地数据文件…')
    setIsPending(true)
    let savedVersion = current.updatedAt
    const queuedWrite = writeQueue.current.catch(() => undefined).then(() => {
      const latest = dataRef.current ?? current
      savedVersion = latest.updatedAt
      return writeDataFile(handle, latest)
    })
    writeQueue.current = queuedWrite
    try {
      await queuedWrite
      if (dataRef.current?.updatedAt === savedVersion) {
        setSaveState('saved')
        setLastSavedAt(new Date().toISOString())
        setMessage('手动保存完成。')
      }
    } catch (error) {
      setSaveState('error')
      setMessage(`保存失败：${friendlyError(error)} 当前内容仍保留在页面中，请重试或导出备份。`)
    } finally {
      setIsPending(false)
    }
  }, [storageMode])

  const value = useMemo<AppStoreValue>(() => ({
    data, saveState, storageMode, fileName, lastSavedAt, message, isPending, supportsFileAccess,
    connect, updateData, removeConnection, importAsPrimary, restoreBackup, exportBackup: exportCurrentBackup, saveNow,
  }), [data, saveState, storageMode, fileName, lastSavedAt, message, isPending, supportsFileAccess, connect, updateData, removeConnection, importAsPrimary, restoreBackup, exportCurrentBackup, saveNow])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useAppStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useAppStore 必须在 AppStoreProvider 中使用。')
  return context
}

export function createMemoryAppData() {
  return emptyAppData()
}
