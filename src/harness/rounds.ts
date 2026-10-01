import type { SafetyReview } from "./validateReview";

export type RoundState = {
  round: number;
  plan: string;
  review: SafetyReview;
};

export function recordRound(rounds: RoundState[], round: number, plan: string, review: SafetyReview) {
  rounds.push({ round, plan, review });
}
