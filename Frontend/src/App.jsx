import { useCallback, useEffect, useMemo, useState } from "react";
import "./TrackingPanel.css";
import DisruptionConsole from "./DisruptionConsole.jsx";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function formatClock(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "--:--";
  const n = ((Number(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

function YardSchematic({ data, selectedId, onSelect }) {
  const trains = data.trains || [];
  const platforms = data.platforms || [];
  const width = 940;
  const height = 430;

  return (
    <div className="schematic-map yard-schematic">
      <div className="yard-title">
        <strong>PUNE JUNCTION</strong>
        <span>ONE STATION · SIX PLATFORMS</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Schematic of Pune Junction with six platform tracks">
        <rect x="0" y="0" width={width} height={height} rx="12" fill="#081321" />
        <rect x="18" y="20" width="904" height="52" rx="8" fill="#13263a" stroke="#29415b" />
        <text x="470" y="42" textAnchor="middle" fill="#e5eefb" fontSize="14" fontWeight="700">PUNE JUNCTION · STATION BUILDING</text>
        <text x="470" y="59" textAnchor="middle" fill="#8fa9c7" fontSize="10">Illustrative yard layout — not an engineering drawing</text>

        {platforms.map((platform, index) => {
          const y = 105 + index * 50;
          const platformTrains = trains.filter((t) => t.platform === platform.id);
          return (
            <g key={platform.id}>
              <rect x="20" y={y - 18} width="900" height="36" rx="5" fill={index % 2 === 0 ? "#101f30" : "#0d1a29"} />
              <text x="36" y={y + 4} fill="#dce8f8" fontSize="13" fontWeight="700">{platform.id}</text>
              <line x1="100" y1={y - 4} x2="850" y2={y - 4} stroke="#6d7d8f" strokeWidth="2" />
              <line x1="100" y1={y + 4} x2="850" y2={y + 4} stroke="#6d7d8f" strokeWidth="2" />
              {Array.from({ length: 25 }, (_, i) => (
                <line key={i} x1={110 + i * 29} y1={y - 8} x2={110 + i * 29} y2={y + 8} stroke="#31465d" strokeWidth="1" />
              ))}
              <text x="865" y={y + 4} fill="#8fa9c7" fontSize="10">{platform.name}</text>
              {platformTrains.map((train, trainIndex) => {
                const selected = train.train_id === selectedId;
                const color = train.route_color || "#60a5fa";
                const markerX = Math.max(140, Math.min(810, train.position?.x ?? (320 + trainIndex * 120)));
                return (
                  <g
                    key={train.train_id}
                    transform={`translate(${markerX} ${y})`}
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
                    {selected && <circle r="21" fill={color} opacity="0.22" />}
                    <rect x="-28" y="-12" width="56" height="24" rx="6" fill="#07101c" stroke={color} strokeWidth={selected ? 3 : 2} />
                    <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{train.train_id}</text>
                    <title>{`${train.train_id} · ${train.train_name} · ${platform.id}`}</title>
                  </g>
                );
              })}
              {platformTrains.length === 0 && (
                <text x="470" y={y + 4} textAnchor="middle" fill="#647991" fontSize="11">No train assigned</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        {platforms.map((platform) => (
          <span key={platform.id}><i style={{ background: (data.routes || []).find((r) => r.id === platform.id)?.color || "#60a5fa" }} />{platform.id}</span>
        ))}
      </div>
    </div>
  );
}

export default function TrackingPanel() {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadTracking = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const response = await fetch(`${API}/tracking`);
      if (!response.ok) throw new Error(`Tracking API returned HTTP ${response.status}`);
      const result = await response.json();
      setData(result);
      setError("");
      setLastUpdate(new Date());
      setSelectedId((current) =>
        current && result.trains.some((train) => train.train_id === current)
          ? current
          : result.trains[0]?.train_id ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tracking data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTracking(true);
    const timer = window.setInterval(() => loadTracking(false), 2000);
    return () => window.clearInterval(timer);
  }, [loadTracking]);

  const trains = data?.trains || [];
  const platforms = data?.platforms || [];
  const selectedTrain = trains.find((train) => train.train_id === selectedId);
  const occupiedCount = useMemo(
    () => new Set(trains.map((train) => train.platform).filter(Boolean)).size,
    [trains]
  );

  return (
    <>
    <section className="tracking-panel">
      <div className="tracking-header">
        <div>
          <p className="eyebrow">STATION OPERATIONS</p>
          <h3>Pune Junction · Yard Control</h3>
          <p className="tracking-subtitle">One station, six platforms, multiple simulated trains.</p>
        </div>
        <span className="simulation-badge"><i /> SIMULATION MODE</span>
      </div>

      <div className="tracking-stats">
        <div><span>Tracked trains</span><strong>{trains.length}</strong></div>
        <div><span>Platforms occupied</span><strong>{occupiedCount} / {platforms.length || 6}</strong></div>
        <div><span>Update interval</span><strong>2 sec</strong></div>
      </div>

      <div className="tracking-toolbar">
        <div className="tracking-updated">
          {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Waiting for tracking data"}
        </div>
      </div>

      {error && (
        <div className="tracking-error" role="alert">
          <strong>Tracking unavailable</strong><span>{error}</span>
          <button type="button" onClick={() => loadTracking(true)}>Retry</button>
        </div>
      )}

      <div className="tracking-layout">
        <div className="tracking-map-column">
          {loading && !data ? (
            <div className="tracking-placeholder">Loading Pune Junction yard…</div>
          ) : data ? (
            <YardSchematic data={data} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <div className="tracking-placeholder">Start the FastAPI backend to load train positions.</div>
          )}
          <p className="tracking-disclaimer">
            Illustrative single-station yard simulation. Not an official timetable or an engineering track plan.
          </p>
        </div>

        <aside className="train-details">
          <p className="eyebrow">SELECTED TRAIN</p>
          {selectedTrain ? (
            <>
              <div className="selected-train-icon">
                <span>↗</span>
                <div><h4>{selectedTrain.train_name}</h4><p>Train {selectedTrain.train_id}</p></div>
              </div>
              <div className="detail-status"><i style={{ background: selectedTrain.route_color }} /> SIMULATED MOVEMENT</div>
              <div className="detail-list">
                <div><span>Assigned platform</span><strong>{selectedTrain.platform || "Unassigned"}</strong></div>
                <div><span>Arrival time</span><strong>{formatClock(selectedTrain.arrival)}</strong></div>
                <div><span>Departure time</span><strong>{formatClock(selectedTrain.departure)}</strong></div>
                <div><span>Station</span><strong>Pune Junction</strong></div>
                <div><span>Movement</span><strong>Within station yard</strong></div>
                <div><span>Platform progress</span><strong>{Math.round((selectedTrain.progress || 0) * 100)}%</strong></div>
              </div>
              <div className="progress-track">
                <div style={{ width: `${Math.round((selectedTrain.progress || 0) * 100)}%`, background: selectedTrain.route_color }} />
              </div>
              <button type="button" className="tracking-refresh" onClick={() => loadTracking(true)}>Refresh tracking data</button>
            </>
          ) : (
            <p className="tracking-subtitle">{loading ? "Loading train details…" : "No train selected."}</p>
          )}
        </aside>
      </div>

      <div className="tracked-train-list">
        <div className="tracked-list-heading"><h4>Station trains</h4><span>{trains.length} total</span></div>
        {trains.map((train) => (
          <button
            key={train.train_id}
            type="button"
            className={`tracked-train-row ${selectedId === train.train_id ? "selected" : ""}`}
            onClick={() => setSelectedId(train.train_id)}
          >
            <span className="route-indicator" style={{ background: train.route_color }} />
            <span className="tracked-train-name">
              <strong>{train.train_name}</strong>
              <small>{train.train_id} · {train.platform || "Unassigned"} · {formatClock(train.arrival)}</small>
            </span>
            <span className="tracked-progress">{Math.round((train.progress || 0) * 100)}%</span>
          </button>
        ))}
      </div>
    </section>
    <DisruptionConsole />
    </>
  );
}
