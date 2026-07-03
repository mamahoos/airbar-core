export const MARKETPLACE_MATCHING_QUEUE = 'marketplace-matching';
export const SHIPMENT_CREATED_MATCHING_JOB = 'shipment-created';
export const TRIP_PUBLISHED_MATCHING_JOB = 'trip-published';

export type MarketplaceMatchingJobData =
  | {
      readonly eventType: typeof SHIPMENT_CREATED_MATCHING_JOB;
      readonly shipmentId: string;
    }
  | {
      readonly eventType: typeof TRIP_PUBLISHED_MATCHING_JOB;
      readonly tripId: string;
    };
