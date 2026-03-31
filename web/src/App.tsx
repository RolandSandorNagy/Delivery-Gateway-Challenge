import { usePickupPoints } from "./features/pickup-points/use-pickup-points";

function App() {
  const { status, pickupPoints, errorMessage, reload } = usePickupPoints();

  return (
    <main className="app-shell">
      <h1>Delivery Gateway Challenge</h1>
      <section className="status-card">
        <p>
          <strong>Status:</strong> {status}
        </p>
        {status === "loading" ? <p>Loading pickup points...</p> : null}
        {status === "error" ? (
          <>
            <p className="error-text">{errorMessage}</p>
            <button type="button" onClick={reload}>
              Retry
            </button>
          </>
        ) : null}
        {status === "success" ? (
          <>
            <p>Loaded pickup points: {pickupPoints.length}</p>
            <button type="button" onClick={reload}>
              Refresh
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

export default App;
