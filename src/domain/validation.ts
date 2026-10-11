import { emptyAppData, type AppData } from './types'

const arrays = [
  'todos', 'memos', 'mediaItems', 'projects', 'milestones', 'projectItems',
  'clients', 'communications', 'fitnessEntries', 'dietEntries', 'games',
] as const

export class DataValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataValidationError'
  }
}

export function validateAppData(value: unknown): AppData {
  if (!value || typeof value !== 'object') throw new DataValidationError('数据文件不是有效的对象。')
  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== 1) throw new DataValidationError(`不支持的数据版本：${String(candidate.schemaVersion ?? '未知')}`)
  for (const key of arrays) {
    if (!Array.isArray(candidate[key])) throw new DataValidationError(`数据文件缺少有效的 ${key} 列表。`)
    const ids = new Set<string>()
    for (const item of candidate[key] as unknown[]) {
      if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') {
        throw new DataValidationError(`${key} 中包含无效记录。`)
      }
      const id = (item as { id: string }).id
      if (ids.has(id)) throw new DataValidationError(`${key} 中存在重复记录 ID。`)
      ids.add(id)
    }
  }
  if (!candidate.preferences || typeof candidate.preferences !== 'object') throw new DataValidationError('数据文件缺少有效的显示设置。')
  return candidate as unknown as AppData
}

export function parseAppData(text: string): AppData {
  if (!text.trim()) return emptyAppData()
  try {
    return validateAppData(JSON.parse(text))
  } catch (error) {
    if (error instanceof DataValidationError) throw error
    throw new DataValidationError('无法解析数据文件。请检查文件或从备份恢复。')
  }
}
