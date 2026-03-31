import type { PickupPoint } from "./model";

type PickupPointInfoPanelProps = {
  activePickupPoint: PickupPoint | null;
  selectedPickupPointId: string | null;
  onSelectPickupPoint: (pickupPointId: string) => void;
};

export const PickupPointInfoPanel = ({
  activePickupPoint,
  selectedPickupPointId,
  onSelectPickupPoint,
}: PickupPointInfoPanelProps) => {
  if (!activePickupPoint) {
    return (
      <section className="info-card">
        <h2>Pickup Point Details</h2>
        <p>Click a marker on the map to see details.</p>
      </section>
    );
  }

  const isSelected = activePickupPoint.id === selectedPickupPointId;

  return (
    <section className="info-card">
      <h2>Pickup Point Details</h2>
      <p>
        <strong>Name:</strong> {activePickupPoint.name}
      </p>
      <p>
        <strong>Address:</strong> {activePickupPoint.address || "N/A"}
      </p>
      <p>
        <strong>Type:</strong> {activePickupPoint.type}
      </p>
      <p>
        <strong>Opening hours:</strong> {activePickupPoint.openingHours || "N/A"}
      </p>
      <p>
        <strong>ID:</strong> {activePickupPoint.id}
      </p>
      {isSelected ? (
        <p className="success-text">This pickup point is selected.</p>
      ) : (
        <button type="button" onClick={() => onSelectPickupPoint(activePickupPoint.id)}>
          Select this pickup point
        </button>
      )}
    </section>
  );
};

