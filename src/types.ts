export type AttendanceStatus = 'present' | 'absent' | 'late'

export type Batch = 'beginner' | 'intermediate' | 'advanced'

export type Category = 'u10' | 'u15' | 'open'

export const BATCH_OPTIONS: { value: Batch; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'u10', label: 'U-10' },
  { value: 'u15', label: 'U-15' },
  { value: 'open', label: 'Open' },
]

export interface AttendanceRecord {
  id: string
  date: string
  status: AttendanceStatus
}

export interface FeePayment {
  id: string
  amount: number
  date: string
  note: string
  isRenewal?: boolean
}

export interface RenewalRecord {
  id: string
  paymentId: string | null
  amount: number
  date: string
  note: string
  classesAtRenewal: number
  sessionsInCycle: number
  createdAt: string
}

export const DEFAULT_SESSIONS_PER_CYCLE = 8

export interface StudentDetailsInput {
  name: string
  age: number
  paymentDate: string
  numberOfClasses: number
  feesPerClass: number
  amountPaid: number
  batch: Batch
  category: Category
}

export interface Student extends StudentDetailsInput {
  id: string
  totalFees: number
  cycleStartClasses: number
  sessionsInCycle: number
  renewalPending: boolean
  renewalCount: number
  attendance: AttendanceRecord[]
  payments: FeePayment[]
  renewals: RenewalRecord[]
  createdAt: string
}

export type TournamentStatus = 'setup' | 'in_progress' | 'completed'

export type PairingResult = '1-0' | '0-1' | '1/2-1/2' | 'bye'

export interface TournamentPlayer {
  id: string
  tournamentId: string
  studentId: string | null
  name: string
  category: Category
}

export interface TournamentPairing {
  id: string
  tournamentId: string
  round: number
  board: number
  whiteId: string
  blackId: string | null
  whiteName: string
  blackName: string | null
  result: PairingResult | null
}

export interface TournamentStanding {
  id: string
  name: string
  category: Category
  points: number
  wins: number
  draws: number
  losses: number
  buchholz: number
  hadBye: boolean
}

export interface Tournament {
  id: string
  name: string
  category: Category
  rounds: number
  currentRound: number
  status: TournamentStatus
  createdAt: string
  players: TournamentPlayer[]
  pairings: TournamentPairing[]
  standings: TournamentStanding[]
  categoryWinners: {
    u10: TournamentStanding[]
    u15: TournamentStanding[]
    open: TournamentStanding[]
  }
}

export type View =
  | 'overview'
  | 'add-student'
  | 'students'
  | 'attendance'
  | 'fees'
  | 'renewal'
  | 'tournament'
  | 'settings'

export type UserRole = 'admin' | 'parent'

export interface TenantBranding {
  id: string
  name: string
  slug: string
  displayName: string
  logoUrl: string
  primaryColor: string
  accentColor: string
  createdAt: string
}

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  tenantId: string
  isOwner?: boolean
  branding?: TenantBranding | null
}

export interface TenantUser {
  id: string
  username: string
  role: UserRole
  createdAt: string
}
