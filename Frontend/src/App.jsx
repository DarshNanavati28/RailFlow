import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

function clock(minutes) {
if (minutes == null) return "--:--";
return "${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}";
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

async function request(path, options = {}) {
const response = await fetch(API + path, {
...options,
headers: { "Content-Type": "application/json", ...options.headers },
});
const data = await response.json();
if (!response.ok) throw new Error(data.detail || "Request failed");
return data;
}

async function refresh() {
try {
const [table, records] = await Promise.all([
request("/timetable"),
request("/history"),
]);
setTrains(table.trains || []);
setConflicts(table.conflicts || []);
setHistory(records.history || []);
setMessage("");
} catch {
setMessage("Backend unavailable. Start the FastAPI server.");
}
}

useEffect(() => {
refresh();
}, []);

async function submit(path, body) {
try {
const result = await request(path, {
method: "POST",
body: JSON.stringify(body),
});
setMessage(result.message || "Request completed.");
await refresh();
} catch (error) {
setMessage(error.message);
}
}

async function validate() {
try {
const result = await request("/validate", { method: "POST" });
setConflicts(result.errors || []);
setMessage(result.valid ? "No platform conflicts detected." : "Found ${result.errors.length} conflict(s).");
} catch (error) {
setMessage(error.message);
}
}

return (
<main className="app">
<header className="topbar">
<div className="brand"><div className="logo">R</div><div><h1>RAILFLOW</h1><p>Railway operations control</p></div></div>
<span className="status">● SIMULATION CONTROL</span>
</header>

  <section className="hero">
    <div><p className="eyebrow">DISPATCH CENTER / LIVE SIMULATION</p><h2>Keep every train<br />on the right track.</h2><p>Monitor platform assignments, simulate disruptions, and validate timetable conflicts.</p></div>
    <div className="hero-icon">🚆</div>
  </section>

  {message && <div className="notice">{message}<button className="secondary" onClick={() => setMessage("")}>Dismiss</button></div>}

  <section className="stats">
    <article className="stat"><span>Total trains</span><strong>{trains.length}</strong><small>Current timetable</small></article>
    <article className="stat"><span>Platforms</span><strong>03</strong><small>P1 · P2 · P3</small></article>
    <article className="stat"><span>Conflicts</span><strong className={conflicts.length ? "bad" : "good"}>{conflicts.length}</strong><small>Backend validation</small></article>
  </section>

  <section className="panel">
    <div className="section-head"><div><p className="eyebrow">OPERATIONS</p><h3>Train timetable</h3></div><button className="secondary" onClick={refresh}>↻ Refresh</button></div>
    <div className="table-wrap"><table><thead><tr><th>TRAIN</th><th>ARRIVAL</th><th>DEPARTURE</th><th>PLATFORM</th></tr></thead><tbody>
      {trains.map(t => <tr key={t.train_id}><td className="train-id">{t.train_id}</td><td>{clock(t.arrival)}</td><td>{clock(t.departure)}</td><td><span className="platform">{t.platform}</span></td></tr>)}
      {!trains.length && <tr><td colSpan="4">No trains loaded. Check backend.</td></tr>}
    </tbody></table></div>
  </section>

  <section className="actions-grid">
    <article className="panel"><p className="eyebrow">SCENARIO 01</p><h3>Simulate train delay</h3><p className="description">Move a train's arrival and departure later.</p>
      <label>Train ID</label><select value={trainId} onChange={e => setTrainId(e.target.value)}>{trains.map(t => <option key={t.train_id}>{t.train_id}</option>)}</select>
      <label>Delay (minutes)</label><input type="number" min="1" max="1440" value={delay} onChange={e => setDelay(Number(e.target.value))}/>
      <button disabled={!trains.length || delay < 1} onClick={() => submit("/disruptions/delay", { train_id: trainId, delay_minutes: delay })}>Apply delay →</button>
    </article>

    <article className="panel"><p className="eyebrow">SCENARIO 02</p><h3>Platform closure</h3><p className="description">Check which trains overlap a closure window.</p>
      <label>Platform</label><select value={platform} onChange={e => setPlatform(e.target.value)}>{["P1", "P2", "P3"].map(p => <option key={p}>{p}</option>)}</select>
      <label>Start (minutes after midnight)</label><input type="number" min="0" max="1439" value={start} onChange={e => setStart(Number(e.target.value))}/>
      <label>End (minutes after midnight)</label><input type="number" min="1" max="1440" value={end} onChange={e => setEnd(Number(e.target.value))}/>
      <button disabled={end <= start} onClick={() => submit("/disruptions/closure", { platform, start, end })}>Check closure →</button>
    </article>
  </section>

  <section className="actions-grid">
    <article className="panel"><p className="eyebrow">SAFETY CHECK</p><h3>Schedule validation</h3><p className="description">Check trains for platform clearance conflicts.</p>
      {conflicts.length > 0 && <ul className="conflict-list">{conflicts.map((c, i) => <li key={i}>{typeof c === "string" ? c : JSON.stringify(c)}</li>)}</ul>}
      <button className="secondary" onClick={validate}>Validate timetable</button>
    </article>
    <article className="panel"><p className="eyebrow">AUDIT LOG</p><h3>Disruption history</h3>
      {!history.length ? <p className="description">No disruptions recorded this session.</p> : <ul className="history-list">{[...history].reverse().map((item, i) => <li key={i}><strong>{item.type.toUpperCase()}</strong><span>{item.train_id || item.platform}</span><small>{item.minutes ? `${item.minutes} min delay` : "Closure recorded"}</small></li>)}</ul>}
    </article>
  </section>
  <footer>RAILFLOW · HACKATHON SIMULATION · NOT FOR LIVE RAILWAY OPERATIONS</footer>
</main>

);
}