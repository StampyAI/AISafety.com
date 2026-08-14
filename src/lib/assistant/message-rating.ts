// Single isolation point for persisting per-message thumbs ratings.
//
// Ratings are NOT persisted yet. The dedicated Airtable field they need does
// not exist on the team's shared base, and a first contribution shouldn't add
// a column to that schema unilaterally — it has to go through a maintainer (see
// the PR's field spec). Until the field is created and wired in below, this
// logs the rating so the signal isn't silently lost and returns.
//
// It must NEVER fall back to writing into an existing field (e.g. the Clicked
// field used for card/link/suggest interactions): doing so corrupts that
// field's meaning. Keeping every rating write behind this one function means
// finishing persistence is a single, contained change here.

/** Airtable field(s) that will hold per-message ratings, on the
 *  assistant_conversations table. PENDING CREATION — not on the base yet, so
 *  there's no field id to write against. Every Airtable field reference for
 *  ratings lives here and nowhere else. */
export const RATING_FIELDS = {
  /** Long-text field: JSON map of turn index → 'up' | 'down'. */
  ratings: 'Ratings',
} as const

export interface MessageRating {
  /** Conversation (session id) the rating belongs to. */
  session: string
  /** Rated reply's index in the stored conversation history. */
  turnIndex: number
  value: 'up' | 'down'
}

/** Persist a visitor's thumbs rating of one assistant reply.
 *
 *  No-ops (with a log) until RATING_FIELDS.ratings exists on the base. When it
 *  does, implement the write HERE: look the row up by session, merge this
 *  turn's rating into the JSON map (a switched thumb overwrites the prior
 *  value), and PATCH only that field — mirroring how recordCitationClick
 *  isolates its write to the Clicked field. Do not touch any other field. */
export async function recordMessageRating(
  rating: MessageRating
): Promise<void> {
  console.log(
    `[assistant:rating] ${JSON.stringify({
      session: rating.session,
      turn: rating.turnIndex,
      value: rating.value,
    })}`
  )
}
