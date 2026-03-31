export const PICKUP_POINTS_QUERY = `
  query PickupPoints(
    $sessionId: ID!
    $first: Int!
    $page: Int
    $filters: PickupPointFilterInput
  ) {
    session(id: $sessionId) {
      pickupPoint {
        pickupPoints(filters: $filters) {
          points(first: $first, page: $page) {
            paginatorInfo {
              currentPage
              hasMorePages
              total
              lastPage
            }
            data {
              id
              name
              type
              address {
                city
                postalCode
                addressLine1
                addressLine2
              }
              location {
                latitude
                longitude
              }
            }
          }
        }
      }
    }
  }
`;

export const PICKUP_POINT_DETAILS_QUERY = `
  query PickupPointDetails(
    $sessionId: ID!
    $id: ID!
  ) {
    session(id: $sessionId) {
      pickupPoint {
        pickupPoint(id: $id) {
          id
          openingHours {
            day
            start {
              hour
              minute
            }
            end {
              hour
              minute
            }
          }
        }
      }
    }
  }
`;
