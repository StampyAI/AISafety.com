export type ListingType =
  | 'job'
  | 'funder'
  | 'advisor'
  | 'community'
  | 'course'
  | 'founder-resource'
  | 'project'
  | 'media-channel'
  | 'org'
  | 'event'

export interface Listing {
  id: string
  type: ListingType
  name: string
  description: string
  organization?: string
  logo?: string
  url: string
  pageUrl: string
  meta: Record<string, string>
  /** Geographic coordinates if known (currently only communities have these). */
  latitude?: number
  longitude?: number
  featured?: boolean
}

export interface Catalog {
  listings: Listing[]
  generatedAt: string
}

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  role: Role
  content: string
}

export interface AssistantRequest {
  messages: ChatMessage[]
  currentPage: string
  pageState?: Record<string, unknown> | null
  referrer?: string | null
  utm?: Record<string, string> | null
  /** Per-tab stable id so multiple turns can be grouped */
  sessionId?: string | null
  /** Client-supplied geo (used when Vercel headers absent, e.g. dev) */
  geoFallback?: { city?: string; region?: string; country?: string } | null
}

export interface UIToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  resultSummary?: string
  /** Listings the tool returned (used to populate the citation lookup) */
  listings?: CitationRef[]
}

/** Streamed assistant message is an ordered sequence of text segments,
 *  tool calls, and an optional `thinking_done` boundary that splits
 *  internal reasoning from the user-facing answer. Everything before the
 *  boundary collapses into a "Searched N times" toggle once it appears. */
export type MessageEvent =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; toolCallId: string }
  | { kind: 'thinking_done' }

export interface CitationRef {
  id: string
  type: ListingType
  name: string
  organization?: string
  logo?: string
  url: string
  pageUrl: string
  description: string
  meta: Record<string, string>
}
