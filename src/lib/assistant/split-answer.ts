// Detection + corrective message for replies the model split by calling a
// tool AFTER its user-facing answer had already begun. Every renderer (live
// widget, stored transcript, admin log) treats text before the last tool
// round as reasoning when no [[/thinking]] follows it, so the pre-search half
// of a split answer would be silently hidden and the visitor would receive a
// reply that opens mid-thought. Instead of amputating, the server sends the
// model back to rewrite the complete answer once — mirroring the
// fabricated-cards redo in stream.ts.

// Below this, the hidden text is assumed to be pre-search narration ("Let me
// search for that.") — a sentence or two — which SHOULD stay hidden. Real
// answers run much longer (observed incidents: 950–5,300 chars). The
// threshold errs toward firing: a false positive costs one extra clean
// generation, a false negative shows the visitor half a message.
const MIN_ANSWER_CHARS = 400

/** True when `text` is too long to be the model narrating its search plan,
 *  i.e. it reads like user-facing answer prose that must not be hidden. */
export function looksLikeAnswerText(text: string): boolean {
  return text.trim().length >= MIN_ANSWER_CHARS
}

/** Corrective message injected when the model began its answer, then ran a
 *  tool round, then finished without re-emitting [[/thinking]]. Sent as a
 *  user turn so the model rewrites the complete answer; the widget renders
 *  only what follows the LAST [[/thinking]] marker, so the visitor never
 *  sees the split draft. */
export function splitAnswerRedoMessage(): string {
  return `[AUTOMATED FORMAT CHECK — this is a server-side check, not the visitor. The visitor will not see your previous draft, so never reference it.]
Your reply ran tool call(s) after the user-facing answer had already begun. The visitor's widget shows only what follows your last tool call, so everything you wrote before that search would be cut off — the reply they see would open mid-thought.
Write the complete final answer again as one uninterrupted message: start your reply with \`[[/thinking]]\` on its own line (even if you have no reasoning to add), then the full answer, then follow-up chips. Reuse what you already wrote where it still holds, card ONLY ids that tool results in this turn actually returned, and do not call any more tools — you already have every result you need. Do not apologize for or mention this correction — just deliver the complete answer.`
}
