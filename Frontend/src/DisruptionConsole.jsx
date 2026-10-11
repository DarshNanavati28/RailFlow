
import { useEffect, useState } from "react";
import "./DisruptionConsole.css";

const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function DisruptionConsole() {
  const [trains, setTrains] = useState([]);
  const [trainId, setTrainId] = useState("");
  const [delay, setDelay] = useState(15);
  const [breakdown, setBreakdown] = useState(20);
  const [conflicts, setConflicts] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data.detail;
      throw new Error(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail || `HTTP ${response.status}`)
      );
    }

    return data;
  }

  async function refresh() {
    const data = await request("/timetable");
    setTrains(data.trains || []);
    setConflicts(data.conflicts || []);
    setTrainId((current) =>
      (data.trains || []).some((t) => t.train_id === current)
        ? current
        : data.trains?.[0]?.train_id || ""
    );
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  async function runAction(path, body, successText) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const data = await request(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMessage(data.message || successText);
      await refresh();
    } catch (e) {
      setError(e.message);
      // Refresh anyway: a failed replan should leave the old timetable intact.
      try {
        await refresh();
      } catch {
        // Preserve the original error.
      }
    } finally {
      setBusy(false);
    }
  }

  async function scanConflicts() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const data = await request("/conflicts/detect", {
        method: "POST",
        body: JSON.stringify({}),
      });

      setConflicts(data.conflicts || []);
      setMessage(
        data.validation?.valid
          ? "Validation passed: no conflicts were reported."
          : "Conflict scan completed. Review the reported issues."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="disruption-console">
      <header className="disruption-header">
        <div>
          <p className="disruption-eyebrow">RAILFLOW CONTROL</p>
          <h2>Disruption &amp; Rescheduling</h2>
          <p>
            Simulate an incident, request a new timetable, and review
            validation results.
          </p>
        </div>
        <span className="simulation-badge">DEMO MODE</span>
      </header>

      <div className="disruption-grid">
        <article className="disruption-card">
          <h3>Train delay</h3>
          <p>Move a train's arrival and departure later.</p>

          <label htmlFor="delay-train">Train</label>
          <select
            id="delay-train"
            value={trainId}
            onChange={(e) => setTrainId(e.target.value)}
            disabled={busy}
          >
            {trains.map((train) => (
              <option key={train.train_id} value={train.train_id}>
                {train.train_id} — {train.train_name}
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
            onChange={(e) => setDelay(Number(e.target.value))}
            disabled={busy}
          />

          <button
            disabled={busy || !trainId || delay < 1 || delay > 1440}
            onClick={() =>
              runAction(
                "/disruptions/delay",
                { train_id: trainId, delay_minutes: delay },
                "Delay applied and timetable replanned."
              )
            }
          >
            Apply delay
          </button>
        </article>

        <article className="disruption-card">
          <h3>Train breakdown</h3>
          <p>
            Simulate a train occupying its platform longer than scheduled.
          </p>

          <label htmlFor="breakdown-train">Train</label>
          <select
            id="breakdown-train"
            value={trainId}
            onChange={(e) => setTrainId(e.target.value)}
            disabled={busy}
          >
            {trains.map((train) => (
              <option key={train.train_id} value={train.train_id}>
                {train.train_id} — {train.train_name}
              </option>
            ))}
          </select>

          <label htmlFor="breakdown-minutes">
            Extra occupancy (minutes)
          </label>
          <input
            id="breakdown-minutes"
            type="number"
            min="1"
            max="240"
            value={breakdown}
            onChange={(e) => setBreakdown(Number(e.target.value))}
            disabled={busy}
          />

          <button
            disabled={busy || !trainId || breakdown < 1 || breakdown > 240}
            onClick={() =>
              runAction(
                "/disruptions/breakdown",
                { train_id: trainId, extra_minutes: breakdown },
                "Breakdown simulated and timetable replanned."
              )
            }
          >
            Simulate breakdown
          </button>
        </article>

        <article className="disruption-card">
          <h3>Cancel train</h3>
          <p>
            Remove a demo train and replan the remaining timetable.
          </p>

          <label htmlFor="cancel-train">Train</label>
          <select
            id="cancel-train"
            value={trainId}
            onChange={(e) => setTrainId(e.target.value)}
            disabled={busy}
          >
            {trains.map((train) => (
              <option key={train.train_id} value={train.train_id}>
                {train.train_id} — {train.train_name}
              </option>
            ))}
          </select>

          <button
            className="danger-button"
            disabled={busy || !trainId}
            onClick={() => {
              if (
                window.confirm(
                  `Cancel demo train ${trainId} and replan?`
                )
              ) {
                runAction(
                  "/disruptions/cancel",
                  { train_id: trainId },
                  "Train cancelled and timetable replanned."
                );
              }
            }}
          >
            Cancel train
          </button>
        </article>

        <article className="disruption-card">
          <h3>Conflict scan</h3>
          <p>
            Check the current timetable without intentionally changing it.
          </p>

          <button
            className="secondary-button"
            disabled={busy}
            onClick={scanConflicts}
          >
            {busy ? "Processing…" : "Detect conflicts"}
          </button>

          <button
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              runAction("/replan", {}, "Replanning completed.")
            }
          >
            Replan timetable
          </button>
        </article>
      </div>

      {message && (
        <div className="disruption-message success-message" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="disruption-message error-message" role="alert">
          {error}
        </div>
      )}

      <article className="disruption-card conflict-results">
        <div className="conflict-heading">
          <h3>Detected conflicts</h3>
          <span>{conflicts.length} reported</span>
        </div>

        {conflicts.length === 0 ? (
          <p>No conflicts are currently reported by the backend.</p>
        ) : (
          <ul>
            {conflicts.map((conflict, index) => (
              <li key={index}>
                {typeof conflict === "string"
                  ? conflict
                  : JSON.stringify(conflict)}
              </li>
            ))}
          </ul>
        )}
      </article>

      <p className="disruption-disclaimer">
        Simulation only. This application does not control real trains,
        railway signals, or track infrastructure.
      </p>
    </section>
  );
}
