export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export type MediaStage = 'idea' | 'production' | 'scheduled' | 'published'
export type ProjectStatus = 'active' | 'paused' | 'completed'
export type WorkItemKind = 'requirement' | 'bug'
export type WorkItemStatus = 'open' | 'in_progress' | 'done'
export type MilestoneStatus = 'upcoming' | 'in_progress' | 'done'
export type GameStatus = 'want_to_play' | 'playing' | 'completed'

export interface Todo {
  id: string
  title: string
  date: string
  recurrence: Recurrence
  completed: boolean
  completedDates: string[]
  endedAt?: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface Memo {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface MediaItem {
  id: string
  title: string
  topic: string
  platform: string
  stage: MediaStage
  plannedDate: string
  publishedAt: string
  views: number | null
  likes: number | null
  saves: number | null
  note: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  description: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: string
  projectId: string
  name: string
  date: string
  status: MilestoneStatus
  note: string
  createdAt: string
  updatedAt: string
}

export interface ProjectItem {
  id: string
  projectId: string
  kind: WorkItemKind
  title: string
  description: string
  status: WorkItemStatus
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  name: string
  contact: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface Communication {
  id: string
  clientId: string
  date: string
  summary: string
  followUpDate: string
  followUpDone: boolean
  createdAt: string
  updatedAt: string
}

export interface FitnessEntry {
  id: string
  date: string
  activity: string
  bodyPart?: string
  sets?: number | null
  reps?: number | null
  duration: string
  completed: boolean
  note: string
  createdAt: string
  updatedAt: string
}

export interface DietEntry {
  id: string
  date: string
  meal: string
  planned: string
  actual: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface Game {
  id: string
  name: string
  status: GameStatus
  plan: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface Preferences {
  theme: 'light' | 'dark'
}

export interface AppData {
  schemaVersion: 1
  createdAt: string
  updatedAt: string
  todos: Todo[]
  memos: Memo[]
  mediaItems: MediaItem[]
  projects: Project[]
  milestones: Milestone[]
  projectItems: ProjectItem[]
  clients: Client[]
  communications: Communication[]
  fitnessEntries: FitnessEntry[]
  dietEntries: DietEntry[]
  games: Game[]
  preferences: Preferences
}

export type NewEntity<T extends { id: string; createdAt: string; updatedAt: string }> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

export const emptyAppData = (now = new Date().toISOString()): AppData => ({
  schemaVersion: 1,
  createdAt: now,
  updatedAt: now,
  todos: [],
  memos: [],
  mediaItems: [],
  projects: [],
  milestones: [],
  projectItems: [],
  clients: [],
  communications: [],
  fitnessEntries: [],
  dietEntries: [],
  games: [],
  preferences: { theme: 'light' },
})

export const makeId = () => crypto.randomUUID()
export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function makeEntity<T extends { id: string; createdAt: string; updatedAt: string }>(value: NewEntity<T>, now = new Date().toISOString()): T {
  return { ...value, id: makeId(), createdAt: now, updatedAt: now } as T
}
