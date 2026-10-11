import { useCallback, useEffect, useMemo, useState } from "react";
import "./TrackingPanel.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const PLATFORM_COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"];
const PLATFORM_IDS = ["P1", "P2", "P3", "P4", "P5", "P6"];

function formatClock(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "--:--";
  const n = ((Number(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

function YardSchematic({ data, selectedId, onSelect, movingTrainId, routeFrom, routeTo }) {
  const trains = data.trains || [];
  const platforms = data.platforms?.length
    ? data.platforms
    : PLATFORM_IDS.map((id) => ({ id, name: `Platform ${id.slice(1)}` }));
  const width = 940;
  const height = 470;
  const yForPlatform = (platformId) => {
    const index = Math.max(0, platforms.findIndex((p) => p.id === platformId));
    return 112 + index * 58;
  };
  const getTrainX = (train, index) => {
    const raw = Number(train.position?.x);
    return Number.isFinite(raw) ? Math.max(150, Math.min(790, raw)) : 245 + (index % 4) * 145;
  };
  const sourceY = routeFrom ? yForPlatform(routeFrom) : null;
  const targetY = routeTo ? yForPlatform(routeTo) : null;

  return (
    <div className="schematic-map yard-schematic">
      <div className="yard-title">
        <strong>PUNE JUNCTION · CONNECTED YARD</strong>
        <span>SIX PLATFORMS · SIMULATED TURNOUTS AND ROUTES</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Connected six-platform railway yard simulation">
        <defs>
          <linearGradient id="routeGlow" x1="0" x2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.15" />
          </linearGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width={width} height={height} rx="12" fill="#081321" />
        <rect x="18" y="17" width="904" height="52" rx="8" fill="#13263a" stroke="#29415b" />
        <text x="470" y="39" textAnchor="middle" fill="#e5eefb" fontSize="14" fontWeight="700">PUNE JUNCTION · STATION BUILDING</text>
        <text x="470" y="55" textAnchor="middle" fill="#8fa9c7" fontSize="10">Illustrative operational simulation — not an engineering drawing</text>

        {/* Connecting lead tracks and turnout spines. */}
        <path d={`M 105 ${yForPlatform("P1")} L 105 ${yForPlatform("P6")}`} fill="none" stroke="#526b83" strokeWidth="3" strokeDasharray="5 5" />
        <path d={`M 105 ${yForPlatform("P1")} C 125 ${yForPlatform("P1")}, 125 ${yForPlatform("P1")}, 150 ${yForPlatform("P1")}`} fill="none" stroke="#7b91a8" strokeWidth="3" />
        <path d={`M 105 ${yForPlatform("P2")} C 125 ${yForPlatform("P2")}, 125 ${yForPlatform("P2")}, 150 ${yForPlatform("P2")}`} fill="none" stroke="#7b91a8" strokeWidth="3" />
        <path d={`M 105 ${yForPlatform("P3")} C 125 ${yForPlatform("P3")}, 125 ${yForPlatform("P3")}, 150 ${yForPlatform("P3")}`} fill="none" stroke="#7b91a8" strokeWidth="3" />
        <path d={`M 105 ${yForPlatform("P4")} C 125 ${yForPlatform("P4")}, 125 ${yForPlatform("P4")}, 150 ${yForPlatform("P4")}`} fill="none" stroke="#7b91a8" strokeWidth="3" />
        <path d={`M 105 ${yForPlatform("P5")} C 125 ${yForPlatform("P5")}, 125 ${yForPlatform("P5")}, 150 ${yForPlatform("P5")}`} fill="none" stroke="#7b91a8" strokeWidth="3" />
        <path d={`M 105 ${yForPlatform("P6")} C 125 ${yForPlatform("P6")}, 125 ${yForPlatform("P6")}, 150 ${yForPlatform("P6")}`} fill="none" stroke="#7b91a8" strokeWidth="3" />

        {platforms.map((platform, index) => {
          const y = 112 + index * 58;
          const color = PLATFORM_COLORS[index % PLATFORM_COLORS.length];
          return (
            <g key={platform.id}>
              <rect x="18" y={y - 20} width="904" height="42" rx="6" fill={index % 2 === 0 ? "#101f30" : "#0d1a29"} stroke={routeTo === platform.id ? "#38bdf8" : "none"} strokeWidth="1.5" />
              <text x="34" y={y + 4} fill="#dce8f8" fontSize="13" fontWeight="700">{platform.id}</text>
              <line x1="150" y1={y - 4} x2="850" y2={y - 4} stroke="#6d7d8f" strokeWidth="2.2" />
              <line x1="150" y1={y + 4} x2="850" y2={y + 4} stroke="#6d7d8f" strokeWidth="2.2" />
              {Array.from({ length: 24 }, (_, i) => (
                <line key={i} x1={160 + i * 29} y1={y - 8} x2={160 + i * 29} y2={y + 8} stroke="#31465d" strokeWidth="1" />
              ))}
              <path d={`M 105 ${y} L 150 ${y}`} fill="none" stroke="#8da2b8" strokeWidth="2.5" />
              <path d={`M 105 ${y} l 10 -4 m -10 4 l 10 4`} fill="none" stroke="#38bdf8" strokeWidth="1.8" />
              <text x="865" y={y + 4} fill={color} fontSize="10">{platform.name || `Platform ${index + 1}`}</text>
              {routeFrom && routeTo && routeFrom !== routeTo && (platform.id === routeFrom || platform.id === routeTo) && (
                <path
                  d={`M 150 ${y} C 122 ${y}, 122 ${(sourceY + targetY) / 2}, 105 ${(sourceY + targetY) / 2} S 125 ${platform.id === routeFrom ? targetY : sourceY}, 150 ${y}`}
                  fill="none" stroke="url(#routeGlow)" strokeWidth="3" opacity="0.7"
                />
              )}
              {/* Turnout symbol at the yard throat. */}
              <path d={`M 92 ${y - 5} l 13 5 l -13 5`} fill="none" stroke={movingTrainId && (platform.id === routeFrom || platform.id === routeTo) ? "#38bdf8" : "#8296ab"} strokeWidth={movingTrainId && (platform.id === routeFrom || platform.id === routeTo) ? 2.8 : 1.5} filter={movingTrainId && (platform.id === routeFrom || platform.id === routeTo) ? "url(#softGlow)" : undefined} />
            </g>
          );
        })}

        {movingTrainId && routeFrom && routeTo && routeFrom !== routeTo && (
          <g className="route-overlay">
            <path
              d={`M 195 ${sourceY} C 125 ${sourceY}, 125 ${targetY}, 195 ${targetY}`}
              fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="8 7" filter="url(#softGlow)"
            />
            <text x="205" y={(sourceY + targetY) / 2 - 7} fill="#7dd3fc" fontSize="10" fontWeight="700">ACTIVE ROUTE</text>
          </g>
        )}

        {trains.map((train, index) => {
          if (train.train_id === movingTrainId) return null;
          const platformIndex = Math.max(0, platforms.findIndex((p) => p.id === train.platform));
          const y = 112 + platformIndex * 58;
          const x = getTrainX(train, index);
          const selected = train.train_id === selectedId;
          const color = train.route_color || PLATFORM_COLORS[platformIndex % PLATFORM_COLORS.length];
          const isMoving = train.train_id === movingTrainId;
          return (
            <g
              key={train.train_id}
              transform={`translate(${x} ${y})`}
              className={`train-marker ${isMoving ? "train-marker-moving" : ""}`}
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
              {selected && <circle r="23" fill={color} opacity="0.22" />}
              {isMoving && <circle r="27" fill="none" stroke="#38bdf8" strokeWidth="2" className="moving-ring" />}
              <rect x="-29" y="-12" width="58" height="24" rx="6" fill="#07101c" stroke={isMoving ? "#38bdf8" : color} strokeWidth={selected || isMoving ? 3 : 2} />
              <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{train.train_id}</text>
              <title>{`${train.train_id} · ${train.train_name} · ${train.platform || "Unassigned"}`}</title>
            </g>
          );
        })}
        {movingTrainId && routeFrom && routeTo && routeFrom !== routeTo && (() => {
          const movingTrain = trains.find((train) => train.train_id === movingTrainId);
          if (!movingTrain) return null;
          const oldIndex = Math.max(0, platforms.findIndex((p) => p.id === routeFrom));
          const movingX = getTrainX(movingTrain, trains.findIndex((t) => t.train_id === movingTrainId));
          const startY = 112 + oldIndex * 58;
          const endY = yForPlatform(routeTo);
          return (
            <g className="animated-train" pointerEvents="none">
              <path d={`M ${movingX} ${startY} C ${movingX - 35} ${startY}, 125 ${(startY + endY) / 2}, 105 ${(startY + endY) / 2} S 140 ${endY}, ${movingX} ${endY}`} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 6" opacity=".65" />
              <g>
                <rect x="-29" y="-12" width="58" height="24" rx="6" fill="#07101c" stroke="#38bdf8" strokeWidth="3" />
                <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{movingTrain.train_id}</text>
                <animateMotion dur="1.8s" fill="freeze" path={`M ${movingX} ${startY} C ${movingX - 35} ${startY}, 125 ${(startY + endY) / 2}, 105 ${(startY + endY) / 2} S 140 ${endY}, ${movingX} ${endY}`} />
              </g>
            </g>
          );
        })()}
      </svg>
      <div className="map-legend">
        {platforms.map((platform, index) => (
          <span key={platform.id}><i style={{ background: PLATFORM_COLORS[index % PLATFORM_COLORS.length] }} />{platform.id}</span>
        ))}
        <span><i className="legend-route" />Active route</span>
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
  const [targetPlatform, setTargetPlatform] = useState("");
  const [movingTrainId, setMovingTrainId] = useState(null);
  const [routeFrom, setRouteFrom] = useState(null);
  const [routeTo, setRouteTo] = useState(null);
  const [movementMessage, setMovementMessage] = useState("");
  const [moving, setMoving] = useState(false);

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
  const platforms = data?.platforms?.length
    ? data.platforms
    : PLATFORM_IDS.map((id) => ({ id, name: `Platform ${id.slice(1)}` }));
  const selectedTrain = trains.find((train) => train.train_id === selectedId);
  const occupiedCount = useMemo(
    () => new Set(trains.map((train) => train.platform).filter(Boolean)).size,
    [trains]
  );

  useEffect(() => {
    if (selectedTrain?.platform) setTargetPlatform(selectedTrain.platform);
  }, [selectedTrain?.train_id, selectedTrain?.platform]);

  const requestPlatformChange = async () => {
    if (!selectedTrain || !targetPlatform || targetPlatform === selectedTrain.platform || moving) return;

    const from = selectedTrain.platform;
    const to = targetPlatform;
    setRouteFrom(from);
    setRouteTo(to);
    setMovingTrainId(selectedTrain.train_id);
    setMoving(true);
    setMovementMessage(`Requesting route ${from} → ${to} for train ${selectedTrain.train_id}…`);
    setError("");

    try {
      const response = await fetch(`${API}/disruptions/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "platform_change",
          train_id: selectedTrain.train_id,
          platform: to,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = body.detail?.result?.reason || body.detail?.message || body.detail || `HTTP ${response.status}`;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }

      setMovementMessage(`Route accepted. Train ${selectedTrain.train_id} is moving ${from} → ${to}.`);
      // Keep the route visible briefly, then refresh the authoritative backend state.
      window.setTimeout(async () => {
        await loadTracking(false);
        setMovingTrainId(null);
        setRouteFrom(null);
        setRouteTo(null);
        setMoving(false);
        setMovementMessage(`Train ${selectedTrain.train_id} reassigned to ${to}.`);
      }, 1800);
    } catch (err) {
      setMovingTrainId(null);
      setRouteFrom(null);
      setRouteTo(null);
      setMoving(false);
      setMovementMessage("");
      setError(err instanceof Error ? err.message : "Platform change failed.");
    }
  };

  return (
    <section className="tracking-panel">
      <div className="tracking-header">
        <div>
          <p className="eyebrow">STATION OPERATIONS</p>
          <h3>Pune Junction · Yard Control</h3>
          <p className="tracking-subtitle">Connected six-platform yard with simulated turnouts and conflict-aware platform reassignment.</p>
        </div>
        <span className="simulation-badge"><i /> SIMULATION MODE</span>
      </div>

      <div className="tracking-stats">
        <div><span>Tracked trains</span><strong>{trains.length}</strong></div>
        <div><span>Platforms occupied</span><strong>{occupiedCount} / {platforms.length}</strong></div>
        <div><span>Yard connections</span><strong>6 turnouts</strong></div>
      </div>

      <div className="tracking-toolbar">
        <div className="tracking-updated">
          {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Waiting for tracking data"}
        </div>
      </div>

      {error && (
        <div className="tracking-error" role="alert">
          <strong>Operation failed</strong><span>{error}</span>
          <button type="button" onClick={() => loadTracking(true)}>Retry</button>
        </div>
      )}

      {movementMessage && <div className="movement-message" role="status">{movementMessage}</div>}

      <div className="tracking-layout">
        <div className="tracking-map-column">
          {loading && !data ? (
            <div className="tracking-placeholder">Loading Pune Junction yard…</div>
          ) : data ? (
            <YardSchematic
              data={data}
              selectedId={selectedId}
              onSelect={setSelectedId}
              movingTrainId={movingTrainId}
              routeFrom={routeFrom}
              routeTo={routeTo}
            />
          ) : (
            <div className="tracking-placeholder">Start the FastAPI backend to load train positions.</div>
          )}
          <p className="tracking-disclaimer">
            Illustrative six-platform station-yard simulation. Turnouts and movements are visualized for the demo; this is not an engineering track plan or real railway signalling system.
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
              <div className="detail-status"><i style={{ background: selectedTrain.route_color || "#60a5fa" }} /> READY FOR SIMULATED ROUTING</div>
              <div className="detail-list">
                <div><span>Assigned platform</span><strong>{selectedTrain.platform || "Unassigned"}</strong></div>
                <div><span>Arrival time</span><strong>{formatClock(selectedTrain.arrival)}</strong></div>
                <div><span>Departure time</span><strong>{formatClock(selectedTrain.departure)}</strong></div>
                <div><span>Station</span><strong>Pune Junction</strong></div>
              </div>

              <label className="platform-route-label" htmlFor="target-platform">Reassign platform</label>
              <div className="platform-route-controls">
                <select
                  id="target-platform"
                  value={targetPlatform}
                  onChange={(event) => setTargetPlatform(event.target.value)}
                  disabled={moving}
                >
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.id}>{platform.id} · {platform.name || `Platform ${platform.id.slice(1)}`}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="tracking-refresh route-button"
                  onClick={requestPlatformChange}
                  disabled={moving || !targetPlatform || targetPlatform === selectedTrain.platform}
                >
                  {moving ? "Routing train…" : "Switch track"}
                </button>
              </div>
              <div className="progress-track">
                <div style={{ width: moving ? "72%" : `${Math.round((selectedTrain.progress || 0) * 100)}%`, background: "#38bdf8" }} />
              </div>
              <button type="button" className="tracking-refresh" onClick={() => loadTracking(true)} disabled={moving}>Refresh tracking data</button>
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
            disabled={moving}
          >
            <span className="route-indicator" style={{ background: train.route_color || "#60a5fa" }} />
            <span className="tracked-train-name">
              <strong>{train.train_name}</strong>
              <small>{train.train_id} · {train.platform || "Unassigned"} · {formatClock(train.arrival)}</small>
            </span>
            <span className="tracked-progress">{Math.round((train.progress || 0) * 100)}%</span>
          </button>
        ))}
      </div>
    </section>
  );
}
