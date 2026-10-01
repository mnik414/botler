// Single source of truth for token-cost estimates shown in the UI.
// Kept in one place so the business dashboard and the admin panel cannot
// display conflicting numbers. Informational only — real billing is plan-based.
export const TOKEN_COST_TOMAN = 0.2; // ~2 Rial per token

export function estimateTokenCost(tokens: number): number {
  return Math.round(Math.max(0, tokens) * TOKEN_COST_TOMAN);
}
