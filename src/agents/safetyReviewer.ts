import OpenAI from "openai";
import { validateReview } from "../harness/validateReview";

export async function runSafetyReviewer(
  client: OpenAI,
  model: string,
  input: string,
  prompt: string,
) {
  return validateReview(client, model, input, prompt);
}
