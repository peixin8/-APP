import { describe, expect, it } from 'vitest'
import { emptyAppData } from './types'
import { DataValidationError, parseAppData, validateAppData } from './validation'

describe('app data validation', () => {
  it('accepts a complete version 1 data file', () => {
    expect(validateAppData(emptyAppData()).schemaVersion).toBe(1)
  })

  it('initializes an empty file with valid data', () => {
    expect(parseAppData('')).toMatchObject({ schemaVersion: 1, todos: [], games: [] })
  })

  it('rejects malformed JSON without inventing empty data', () => {
    expect(() => parseAppData('{')).toThrow('无法解析数据文件')
  })

  it('rejects unsupported schema versions', () => {
    expect(() => validateAppData({ ...emptyAppData(), schemaVersion: 2 })).toThrow('不支持的数据版本')
  })

  it('rejects missing collections and duplicate identifiers', () => {
    const missing = { ...emptyAppData(), games: undefined }
    expect(() => validateAppData(missing)).toThrow(DataValidationError)
    const duplicate = { ...emptyAppData(), games: [{ id: 'same' }, { id: 'same' }] }
    expect(() => validateAppData(duplicate)).toThrow('重复记录 ID')
  })
})
