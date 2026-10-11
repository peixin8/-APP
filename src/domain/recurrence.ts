import type { Recurrence, Todo } from './types'

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function occursOn(todo: Pick<Todo, 'date' | 'recurrence' | 'endedAt'>, dateKey: string): boolean {
  if (dateKey < todo.date || (todo.endedAt && dateKey > todo.endedAt)) return false
  const target = parseLocalDate(dateKey)
  const start = parseLocalDate(todo.date)
  const recurrence: Recurrence = todo.recurrence
  if (recurrence === 'none') return dateKey === todo.date
  if (recurrence === 'daily') return true
  if (recurrence === 'weekly') return target.getDay() === start.getDay()
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return target.getDate() === Math.min(start.getDate(), lastDay)
}

export function todosForDate<T extends Pick<Todo, 'date' | 'recurrence' | 'endedAt' | 'completed' | 'completedDates'>>(todos: T[], dateKey: string) {
  return todos.filter((todo) => occursOn(todo, dateKey)).map((todo) => ({
    todo,
    completed: todo.recurrence === 'none' ? todo.completed : todo.completedDates.includes(dateKey),
  }))
}

export function stopRecurrence(todo: Todo, dateKey: string): Todo {
  if (todo.recurrence === 'none') return todo
  const yesterday = new Date(parseLocalDate(dateKey).getTime() - 24 * 60 * 60 * 1000)
  const endedAt = keyOf(yesterday)
  return { ...todo, endedAt, updatedAt: new Date().toISOString() }
}
