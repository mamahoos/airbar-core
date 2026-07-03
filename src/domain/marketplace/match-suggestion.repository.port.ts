export const MATCH_SUGGESTION_REPOSITORY = Symbol('MATCH_SUGGESTION_REPOSITORY');

export type MatchSuggestionStatus = 'SUGGESTED' | 'DISMISSED' | 'ASSIGNED' | 'EXPIRED';

export interface MatchSuggestionInput {
  readonly shipmentId: string;
  readonly tripId: string;
  readonly score: number;
  readonly factors: unknown;
  readonly source: string;
}

export interface MatchSuggestionRecord {
  readonly id: string;
  readonly shipmentId: string;
  readonly tripId: string;
  readonly score: number;
  readonly factors: unknown;
  readonly source: string;
  readonly status: MatchSuggestionStatus;
  readonly suggestedAt: Date;
  readonly updatedAt: Date;
}

export interface MatchSuggestionRepositoryPort {
  upsert(input: MatchSuggestionInput): Promise<MatchSuggestionRecord>;
  listForShipment(shipmentId: string, limit: number): Promise<readonly MatchSuggestionRecord[]>;
  listForTrip(tripId: string, limit: number): Promise<readonly MatchSuggestionRecord[]>;
}
