import type { RoundState } from "./rounds";

export const MIN_SAFE_SCORE = 7;

export function summarizeScore(rounds: RoundState[]) {
  const last = rounds[rounds.length - 1];
  return {
    finalScore: last?.review.verdict === "approve" ? last.review.score : null,
    improved: rounds.length > 1 && last.review.score > rounds[0].review.score,
  };
}
