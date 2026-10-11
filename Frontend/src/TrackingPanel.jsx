
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./TrackingPanel.css";

const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function formatClock(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "--:--";
  const n = ((Number(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

function SchematicMap({ data, selectedId, onSelect }) {
  const stations = data.stations || [];
  const routes = data.routes || [];
  const trains = data.trains || [];

  const stationLookup = useMemo(
    () => Object.fromEntries(stations.map((station) => [station.id, station])),
    [stations]
  );

  return (
    <div className="schematic-map">
      <svg
        viewBox="0 0 360 280"
        role="img"
        aria-label="Schematic map of the simulated railway network"
        preserveAspectRatio="xMidYMid meet"
      >
        {routes.map((route) => {
          const points = route.stations
            .map((id) => stationLookup[id])
            .filter(Boolean)
            .map((station) => `${station.x},${station.y}`)
            .join(" ");

          return (
            <polyline
              key={route.id}
              points={points}
              fill="none"
              stroke={route.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.75"
            />
          );
        })}

        {stations.map((station) => (
          <g key={station.id}>
            <circle
              cx={station.x}
              cy={station.y}
              r="7"
              fill="#101a2b"
              stroke="#dce8f8"
              strokeWidth="2.5"
            />
            <text
              x={station.x}
              y={station.y - 15}
              textAnchor="middle"
              className="station-label"
            >
              {station.name}
            </text>
          </g>
        ))}

        {trains.map((train) => {
          const pos = train.position;
          if (!pos) return null;

          const selected = train.train_id === selectedId;
          const color = train.route_color || "#60a5fa";

          return (
            <g
              key={train.train_id}
              transform={`translate(${pos.x} ${pos.y})`}
              className="train-marker"
              role="button"
              tabIndex="0"
              aria-label={`Select train ${train.train_id}`}
              onClick={() => onSelect(train.train_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(train.train_id);
                }
              }}
            >
              {selected && (
                <circle
                  r="17"
                  fill={color}
                  opacity="0.18"
                  className="train-pulse"
                />
              )}
              <circle
                r={selected ? 12 : 10}
                fill="#0b1525"
                stroke={color}
                strokeWidth={selected ? 3 : 2}
              />
              <text
                y="4"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="700"
              >
                T
              </text>
              <title>{`${train.train_id} · ${train.train_name}`}</title>
            </g>
          );
        })}
      </svg>

      <div className="map-legend">
        {routes.map((route) => (
          <span key={route.id}>
            <i style={{ background: route.color }} />
            {route.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function FitMap({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function GeographicMap({ data, selectedId, onSelect }) {
  const stations = data.stations || [];
  const routes = data.routes || [];
  const trains = data.trains || [];

  const stationLookup = useMemo(
    () => Object.fromEntries(stations.map((station) => [station.id, station])),
    [stations]
  );

  const selectedTrain = trains.find(
    (train) => train.train_id === selectedId
  );

  const center = selectedTrain?.position
    ? [selectedTrain.position.lat, selectedTrain.position.lng]
    : [18.52, 73.83];

  return (
    <div className="geo-map">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        className="leaflet-map"
      >
        <FitMap center={center} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routes.map((route) => {
          const positions = route.stations
            .map((id) => stationLookup[id])
            .filter(Boolean)
            .map((station) => [station.lat, station.lng]);

          return (
            <Polyline
              key={route.id}
              positions={positions}
              pathOptions={{
                color: route.color,
                weight: 5,
                opacity: 0.8,
              }}
            />
          );
        })}

        {stations.map((station) => (
          <CircleMarker
            key={station.id}
            center={[station.lat, station.lng]}
            radius={6}
            pathOptions={{
              color: "#e2e8f0",
              fillColor: "#0f172a",
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip>{station.name}</Tooltip>
          </CircleMarker>
        ))}

        {trains.map((train) => {
          if (!train.position) return null;

          const selected = train.train_id === selectedId;

          return (
            <CircleMarker
              key={train.train_id}
              center={[train.position.lat, train.position.lng]}
              radius={selected ? 10 : 7}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: train.route_color || "#60a5fa",
                fillOpacity: 1,
              }}
              eventHandlers={{
                click: () => onSelect(train.train_id),
              }}
            >
              <Tooltip permanent={selected}>
                {train.train_id}
              </Tooltip>
              <Popup>
                <strong>{train.train_name}</strong>
                <br />
                Train {train.train_id}
                <br />
                Platform: {train.platform || "Unassigned"}
                <br />
                Simulation only
                <br />
                <button
                  type="button"
                  onClick={() => onSelect(train.train_id)}
                >
                  View train details
                </button>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default function TrackingPanel() {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("schematic");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadTracking = useCallback(async (initial = false) => {
    if (initial) setLoading(true);

    try {
      const response = await fetch(`${API}/tracking`);

      if (!response.ok) {
        throw new Error(`Tracking API returned HTTP ${response.status}`);
      }

      const result = await response.json();

      setData(result);
      setError("");
      setLastUpdate(new Date());

      setSelectedId((current) => {
        if (
          current &&
          result.trains.some((train) => train.train_id === current)
        ) {
          return current;
        }

        return result.trains[0]?.train_id ?? null;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tracking data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTracking(true);

    const timer = window.setInterval(() => {
      loadTracking(false);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [loadTracking]);

  const trains = data?.trains || [];

  const selectedTrain = trains.find(
    (train) => train.train_id === selectedId
  );

  const onTimeCount = trains.length;

  return (
    <section className="tracking-panel">
      <div className="tracking-header">
        <div>
          <p className="eyebrow">NETWORK INTELLIGENCE</p>
          <h3>Train Tracking Center</h3>
          <p className="tracking-subtitle">
            Follow simulated train movement across the railway network.
          </p>
        </div>

        <span className="simulation-badge">
          <i />
          SIMULATION MODE
        </span>
      </div>

      <div className="tracking-stats">
        <div>
          <span>Tracked trains</span>
          <strong>{trains.length}</strong>
        </div>
        <div>
          <span>Network stations</span>
          <strong>{data?.stations?.length ?? "—"}</strong>
        </div>
        <div>
          <span>Update interval</span>
          <strong>2 sec</strong>
        </div>
      </div>

      <div className="tracking-toolbar">
        <div className="view-switch" aria-label="Map view">
          <button
            type="button"
            className={view === "schematic" ? "active" : ""}
            onClick={() => setView("schematic")}
          >
            Schematic
          </button>
          <button
            type="button"
            className={view === "geographic" ? "active" : ""}
            onClick={() => setView("geographic")}
          >
            Geographic
          </button>
        </div>

        <div className="tracking-updated">
          {lastUpdate
            ? `Updated ${lastUpdate.toLocaleTimeString()}`
            : "Waiting for tracking data"}
        </div>
      </div>

      {error && (
        <div className="tracking-error" role="alert">
          <strong>Tracking unavailable</strong>
          <span>{error}</span>
          <button type="button" onClick={() => loadTracking(true)}>
            Retry
          </button>
        </div>
      )}

      <div className="tracking-layout">
        <div className="tracking-map-column">
          {loading && !data ? (
            <div className="tracking-placeholder">
              Loading railway network…
            </div>
          ) : data ? (
            view === "schematic" ? (
              <SchematicMap
                data={data}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <GeographicMap
                data={data}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )
          ) : (
            <div className="tracking-placeholder">
              Start the FastAPI backend to load train positions.
            </div>
          )}

          <p className="tracking-disclaimer">
            Simulated positions and routes. Not live GPS or operational
            railway information.
          </p>
        </div>

        <aside className="train-details">
          <p className="eyebrow">SELECTED TRAIN</p>

          {selectedTrain ? (
            <>
              <div className="selected-train-icon">
                <span>↗</span>
                <div>
                  <h4>{selectedTrain.train_name}</h4>
                  <p>Train {selectedTrain.train_id}</p>
                </div>
              </div>

              <div className="detail-status">
                <i style={{ background: selectedTrain.route_color }} />
                SIMULATED MOVEMENT
              </div>

              <div className="detail-list">
                <div>
                  <span>Assigned platform</span>
                  <strong>{selectedTrain.platform || "Unassigned"}</strong>
                </div>
                <div>
                  <span>Arrival time</span>
                  <strong>{formatClock(selectedTrain.arrival)}</strong>
                </div>
                <div>
                  <span>Departure time</span>
                  <strong>{formatClock(selectedTrain.departure)}</strong>
                </div>
                <div>
                  <span>Current route</span>
                  <strong>{selectedTrain.route_name}</strong>
                </div>
                <div>
                  <span>Between stations</span>
                  <strong>{selectedTrain.position?.from_station}</strong>
                </div>
                <div>
                  <span>Next station</span>
                  <strong>{selectedTrain.next_station}</strong>
                </div>
                <div>
                  <span>Journey progress</span>
                  <strong>
                    {Math.round((selectedTrain.progress || 0) * 100)}%
                  </strong>
                </div>
              </div>

              <div className="progress-track">
                <div
                  style={{
                    width: `${Math.round((selectedTrain.progress || 0) * 100)}%`,
                    background: selectedTrain.route_color,
                  }}
                />
              </div>

              <button
                type="button"
                className="tracking-refresh"
                onClick={() => loadTracking(true)}
              >
                Refresh tracking data
              </button>
            </>
          ) : (
            <p className="tracking-subtitle">
              {loading
                ? "Loading train details…"
                : "No train selected or no tracking data available."}
            </p>
          )}
        </aside>
      </div>

      <div className="tracked-train-list">
        <div className="tracked-list-heading">
          <h4>Network trains</h4>
          <span>{trains.length} total</span>
        </div>

        {trains.map((train) => (
          <button
            key={train.train_id}
            type="button"
            className={`tracked-train-row ${selectedId === train.train_id ? "selected" : ""}`}
            onClick={() => setSelectedId(train.train_id)}
          >
            <span
              className="route-indicator"
              style={{ background: train.route_color }}
            />
            <span className="tracked-train-name">
              <strong>{train.train_name}</strong>
              <small>
                {train.train_id} · {train.platform || "Unassigned"}
              </small>
            </span>
            <span className="tracked-progress">
              {Math.round((train.progress || 0) * 100)}%
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
