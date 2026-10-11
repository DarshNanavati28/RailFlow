import TrackingPanel from "./TrackingPanel.jsx";
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const PLATFORMS = ["P1", "P2", "P3"];

function clock(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) {
    return "--:--";
  }

  const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot connect to ${API}. Start FastAPI and check CORS settings.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => item.msg || JSON.stringify(item)).join("; ")
          : detail
            ? JSON.stringify(detail)
            : `Request failed: HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="section-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, description, tone = "" }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      <small>{description}</small>
    </article>
  );
}

export default function App() {
  const [trains, setTrains] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [history, setHistory] = useState([]);

  const [trainId, setTrainId] = useState("T101");
  const [delay, setDelay] = useState(20);
  const [platform, setPlatform] = useState("P1");
  const [start, setStart] = useState(600);
  const [end, setEnd] = useState(640);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const [table, records] = await Promise.all([
        apiRequest("/timetable"),
        apiRequest("/history"),
      ]);

      setTrains(Array.isArray(table.trains) ? table.trains : []);
      setConflicts(Array.isArray(table.conflicts) ? table.conflicts : []);
      setHistory(Array.isArray(records.history) ? records.history : []);

      setBackendOnline(true);
      setLastUpdated(new Date());
      setMessage("");
      setMessageType("info");
    } catch (error) {
      setBackendOnline(false);
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const handleFocus = () => refresh(false);
    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  useEffect(() => {
    if (
      trains.length > 0 &&
      !trains.some((train) => train.train_id === trainId)
    ) {
      setTrainId(trains[0].train_id);
    }
  }, [trains, trainId]);

  async function submit(path, body, successMessage) {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      const result = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMessage(result.message || successMessage);
      setMessageType("success");

      await refresh(false);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function validate() {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      const result = await apiRequest("/validate", {
        method: "POST",
      });

      const errors = Array.isArray(result.errors)
        ? result.errors
        : Array.isArray(result.conflicts)
          ? result.conflicts
          : [];

      setConflicts(errors);

      const valid =
        typeof result.valid === "boolean"
          ? result.valid
          : errors.length === 0;

      setMessage(
        valid
          ? "Validation completed. No conflicts reported."
          : `Validation completed. ${errors.length} issue(s) reported.`
      );
      setMessageType(valid ? "success" : "error");

      await refresh(false);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  const delayValid =
    Number.isFinite(delay) && delay >= 1 && delay <= 1440;

  const closureValid =
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end <= 1440 &&
    end > start;

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">R</div>
          <div>
            <h1>RAILFLOW</h1>
            <p>Railway operations control</p>
          </div>
        </div>

        <div
          className={`status ${backendOnline ? "online" : "offline"}`}
          role="status"
          aria-live="polite"
        >
          <span>{backendOnline ? "●" : "○"}</span>
          {backendOnline ? "BACKEND CONNECTED" : "BACKEND OFFLINE"}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">DISPATCH CENTER / LIVE SIMULATION</p>
          <h2>
            Keep every train
            <br />
            on the right track.
          </h2>
          <p className="hero-description">
            Monitor platform assignments, simulate disruptions, and validate
            timetable conflicts from one control desk.
          </p>
        </div>

        <div className="hero-icon" aria-hidden="true">
          🚆
        </div>
      </section>
      <TrackingPanel />
      {message && (
        <div
          className={`notice ${messageType}`}
          role="status"
          aria-live="polite"
        >
          <span>{message}</span>
          <button
            type="button"
            className="secondary compact"
            onClick={() => setMessage("")}
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="stats" aria-label="Operations overview">
        <MetricCard
          label="Total trains"
          value={loading ? "…" : trains.length}
          description="Trains in current timetable"
        />

        <MetricCard
          label="Platforms"
          value="03"
          description="P1 · P2 · P3"
        />

        <MetricCard
          label="Reported conflicts"
          value={loading ? "…" : conflicts.length}
          description="Latest backend validation data"
          tone={conflicts.length ? "bad" : "good"}
        />
      </section>

      <section className="panel">
        <SectionHeading eyebrow="OPERATIONS" title="Train timetable">
          <button
            type="button"
            className="secondary"
            onClick={() => refresh()}
            disabled={loading}
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </SectionHeading>

        <div className="table-meta">
          <span>Scheduled trains and platform assignments</span>
          <span>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Waiting for backend"}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TRAIN</th>
                <th>TRAIN NUMBER</th>
                <th>ARRIVAL</th>
                <th>DEPARTURE</th>
                <th>PLATFORM</th>
              </tr>
            </thead>

            <tbody>
              {loading && trains.length === 0 ? (
                <tr>
                  <td colSpan={4}>Loading timetable…</td>
                </tr>
              ) : trains.length > 0 ? (
                trains.map((train) => (
                  <tr key={train.train_id}>
  <td className="train-name">
    {train.train_name || "Unknown train"}
  </td>
  <td className="train-id">{train.train_id}</td>
  <td>{clock(train.arrival)}</td>
  <td>{clock(train.departure)}</td>
  <td>
    <span className="platform">
      {train.platform || "Unassigned"}
    </span>
  </td>
</tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    {backendOnline
                      ? "No trains in the current timetable."
                      : "Timetable unavailable. Start the backend and refresh."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="actions-grid">
        <article className="panel">
          <p className="eyebrow">SCENARIO 01</p>
          <h3>Simulate train delay</h3>
          <p className="description">
            Apply a delay and let the backend process the disruption.
          </p>

          <label htmlFor="delay-train">Train ID</label>
          <select
            id="delay-train"
            value={trainId}
            onChange={(event) => setTrainId(event.target.value)}
            disabled={!trains.length || busy}
          >
            {trains.map((train) => (
              <option key={train.train_id} value={train.train_id}>
                {train.train_id}
              </option>
            ))}
          </select>

          <label htmlFor="delay-minutes">Delay (minutes)</label>
          <input
            id="delay-minutes"
            type="number"
            min="1"
            max="1440"
            value={delay}
            onChange={(event) => setDelay(Number(event.target.value))}
            disabled={busy}
          />

          <button
            type="button"
            disabled={
              !backendOnline || !trains.length || !delayValid || busy
            }
            onClick={() =>
              submit(
                "/disruptions/delay",
                { train_id: trainId, delay_minutes: delay },
                "Delay request completed."
              )
            }
          >
            {busy ? "Processing…" : "Apply delay →"}
          </button>
        </article>

        <article className="panel">
          <p className="eyebrow">SCENARIO 02</p>
          <h3>Platform closure</h3>
          <p className="description">
            Submit a platform closure interval for the scheduler to evaluate.
          </p>

          <label htmlFor="closure-platform">Platform</label>
          <select
            id="closure-platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            disabled={busy}
          >
            {PLATFORMS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label htmlFor="closure-start">Start time (minutes after midnight)</label>
          <input
            id="closure-start"
            type="number"
            min="0"
            max="1439"
            value={start}
            onChange={(event) => setStart(Number(event.target.value))}
            disabled={busy}
          />
          <p className="field-hint">{clock(start)}</p>

          <label htmlFor="closure-end">End time (minutes after midnight)</label>
          <input
            id="closure-end"
            type="number"
            min="1"
            max="1440"
            value={end}
            onChange={(event) => setEnd(Number(event.target.value))}
            disabled={busy}
          />
          <p className="field-hint">
            {end === 1440 ? "24:00" : clock(end)}
          </p>

          <button
            type="button"
            disabled={!backendOnline || !closureValid || busy}
            onClick={() =>
              submit(
                "/disruptions/closure",
                { platform, start, end },
                "Closure request completed."
              )
            }
          >
            {busy ? "Processing…" : "Apply closure →"}
          </button>
        </article>
      </section>

      <section className="actions-grid">
        <article className="panel">
          <p className="eyebrow">SAFETY CHECK</p>
          <h3>Schedule validation</h3>
          <p className="description">
            Request independent validation from the backend.
          </p>

          {conflicts.length > 0 ? (
            <ul className="conflict-list">
              {conflicts.map((conflict, index) => (
                <li key={index}>
                  {typeof conflict === "string"
                    ? conflict
                    : JSON.stringify(conflict)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="description validation-empty">
              {loading
                ? "Loading validation data…"
                : "No conflicts are currently reported. Run validation to check the timetable."}
            </p>
          )}

          <button
            type="button"
            className="secondary"
            disabled={!backendOnline || busy}
            onClick={validate}
          >
            {busy ? "Checking…" : "Validate timetable"}
          </button>
        </article>

        <article className="panel">
          <p className="eyebrow">AUDIT LOG</p>
          <h3>Disruption history</h3>
          <p className="description">
            Events returned by the backend for this session.
          </p>

          {history.length === 0 ? (
            <p className="description">
              {loading
                ? "Loading history…"
                : "No disruption records returned."}
            </p>
          ) : (
            <ul className="history-list">
              {[...history].reverse().map((item, index) => (
                <li key={`${item.type || "event"}-${index}`}>
                  <strong>{String(item.type || "EVENT").toUpperCase()}</strong>
                  <span>
                    {item.train_id || item.platform || "System"}
                  </span>
                  <small>
                    {item.minutes != null
                      ? `${item.minutes} min delay`
                      : item.start != null && item.end != null
                        ? `${clock(item.start)}–${item.end === 1440 ? "24:00" : clock(item.end)}`
                        : "Event recorded"}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <footer>
        RAILFLOW · HACKATHON SIMULATION · NOT FOR LIVE RAILWAY OPERATIONS
      </footer>
    </main>
  );
}