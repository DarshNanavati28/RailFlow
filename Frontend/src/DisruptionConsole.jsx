
import { useEffect, useState } from "react";
import "./DisruptionConsole.css";

const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function DisruptionConsole() {
  const [aiLoading, setAiLoading] = useState(false);
const [aiError, setAiError] = useState("");
const [aiResult, setAiResult] = useState(null);

const [aiOpen, setAiOpen] = useState(false);
const [aiMessage, setAiMessage] = useState("");
  
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


<>
  <button
    type="button"
    className="ai-launch-button"
    onClick={() => setAiOpen(true)}
  >
    <span className="ai-launch-icon">✦</span>
    <span>
      <strong>AI Disruption Assistant</strong>
      <small>Ask AI to interpret a railway disruption</small>
    </span>
    <span className="ai-launch-arrow">↗</span>
  </button>

  {aiOpen && (
    <div className="ai-chat-overlay">
      <section
        className="ai-chat-window"
        role="dialog"
        aria-modal="true"
        aria-label="AI Disruption Assistant"
      >
        <header className="ai-chat-header">
          <div className="ai-chat-avatar">✦</div>
          <div className="ai-chat-title">
            <strong>RailFlow AI</strong>
            <small>Disruption Assistant</small>
          </div>
          <button
            type="button"
            className="ai-close-button"
            onClick={() => setAiOpen(false)}
            aria-label="Close assistant"
          >
            ×
          </button>
        </header>

        <div className="ai-chat-body">
          <div className="ai-welcome-message">
            <strong>Hey! I'm your RailFlow AI assistant.</strong>
            <p>
              Describe a train delay or railway disruption in plain English.
              I'll interpret the details for you.
            </p>
          </div>

          
{aiResult && (
  <div className="ai-chat-result">
    <strong>Interpretation</strong>
    <pre>{JSON.stringify(aiResult, null, 2)}</pre>

    {aiResult.action === "delay" &&
      aiResult.train_id &&
      Number.isInteger(aiResult.delay_minutes) &&
      aiResult.delay_minutes > 0 &&
      !aiResult.applied && (
        <button
          type="button"
          className="ai-send-button"
          onClick={() =>
            setAiResult({
              ...aiResult,
              awaitingConfirmation: true,
            })
          }
        >
          Review & Apply Delay
        </button>
      )}

    {aiResult.awaitingConfirmation && (
      <div className="ai-confirm-box">
        <p>
          Apply a {aiResult.delay_minutes}-minute delay to train{" "}
          {aiResult.train_id} and replan the timetable?
        </p>

        <button
          type="button"
          className="ai-send-button"
          disabled={aiLoading}
          onClick={async () => {
            setAiLoading(true);
            setAiError("");

            try {
              const response = await fetch(
                "http://127.0.0.1:8000/disruptions/delay",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    train_id: String(aiResult.train_id),
                    delay_minutes: aiResult.delay_minutes,
                  }),
                }
              );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(
                  typeof data.detail === "string"
                    ? data.detail
                    : JSON.stringify(data.detail)
                );
              }

              setAiResult({
                action: "delay",
                train_id: aiResult.train_id,
                delay_minutes: aiResult.delay_minutes,
                applied: true,
                summary: data.message,
              });

              window.dispatchEvent(
                new CustomEvent("railflow-timetable-updated", {
                  detail: data,
                })
              );
            } catch (error) {
              setAiError(error.message || "Could not apply delay.");
            } finally {
              setAiLoading(false);
            }
          }}
        >
          {aiLoading ? "Replanning..." : "Confirm & Apply"}
        </button>

        
<button
  type="button"
  className="ai-cancel-button"
  disabled={aiLoading}
  onClick={() =>
    setAiResult({
      ...aiResult,
      awaitingConfirmation: false,
    })
  }
>
  Cancel
</button>

      </div>
    )}

    {aiResult.applied && (
      <p>✅ {aiResult.summary}</p>
    )}

    <small>
      AI interpretation is a proposal. Verify the train ID before applying.
    </small>
  </div>
)}


          {aiError && (
            <p className="ai-assistant-error">{aiError}</p>
          )}
        </div>

        <form
          className="ai-chat-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const message = aiMessage.trim();
            if (!message || aiLoading) return;

            setAiLoading(true);
            setAiError("");
            setAiResult(null);

            try {
              const response = await fetch(
                "http://127.0.0.1:8000/ai/interpret-disruption",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ message }),
                }
              );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(
                  data.detail || "The AI request failed."
                );
              }

              setAiResult(data);
            } catch (error) {
              setAiError(
                error.message || "Could not connect to the backend."
              );
            } finally {
              setAiLoading(false);
            }
          }}
        >
          <textarea
            value={aiMessage}
            onChange={(event) => setAiMessage(event.target.value)}
            placeholder="e.g. Train 12025 is delayed by 20 minutes..."
            rows={3}
            minLength={3}
            maxLength={1000}
            required
          />

          <button
            type="submit"
            className="ai-send-button"
            disabled={aiLoading || !aiMessage.trim()}
          >
            {aiLoading ? "Thinking..." : "Interpret disruption ↗"}
          </button>
        </form>
      </section>
    </div>
  )}
</>


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
