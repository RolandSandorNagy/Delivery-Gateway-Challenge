export const PICKUP_POINTS_QUERY = `
  query PickupPoints(
    $sessionId: ID!
    $first: Int!
    $page: Int
    $filters: PickupPointFilterInput
  ) {
    session(id: $sessionId) {
      pickupPoint {
        pickupPoints {
          points(first: $first, page: $page, filters: $filters) {
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
    }
  }
`;
