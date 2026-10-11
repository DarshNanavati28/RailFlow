
import { useState } from "react";
import "./Login.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    // DEMO ONLY: frontend credentials are not secure authentication.
    if (username === "admin" && password === "RailFlow@123") {
      onLogin({ username });
    } else {
      setError("Invalid username or password.");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo">R</div>
        <p className="login-eyebrow">RAILWAY OPERATIONS SYSTEM</p>
        <h1>Welcome to RailFlow</h1>
        <p className="login-subtitle">
          Sign in to access the dispatch and disruption control center.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-button" type="submit">
            Sign in to RailFlow →
          </button>
        </form>

        <p className="login-footer">
          RAILFLOW · HACKATHON DEMONSTRATION
        </p>
      </section>
    </main>
  );
}
