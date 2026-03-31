// NOTE: Field names will be validated against the live schema before wiring UI.
export const PICKUP_POINTS_QUERY = `
  query PickupPoints(
    $merchantId: ID!
    $sessionId: ID!
  ) {
    pickupPoints(
      merchantId: $merchantId
      sessionId: $sessionId
    ) {
      id
      name
      type
      openingHours
      address {
        formatted
      }
      location {
        lat
        lng
      }
    }
  }
`;

