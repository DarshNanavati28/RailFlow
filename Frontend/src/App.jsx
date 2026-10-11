import TrackingPanel from "./TrackingPanel.jsx";
import DisruptionConsole from "./DisruptionConsole.jsx";
import "./App.css";

export default function App({ loggedInUser, onLogout }) {
  return (
    <div className="app-container">
      <header className="topbar">
        <div className="brand">
          <h1>RailFlow</h1>
          <span>Railway Operations & Disruption Control</span>
        </div>

        <div className="user-controls">
          <span>
            Signed in as{" "}
            <strong>{loggedInUser?.username || "Admin"}</strong>
          </span>

          <button
            type="button"
            className="logout-button"
            onClick={onLogout}
          >
            Log out ↗
          </button>
        </div>
      </header>

      <main className="app-content">
        <TrackingPanel />
        <DisruptionConsole />
      </main>
    </div>
  );
}