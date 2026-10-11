
import { useState } from "react";
import App from "./App.jsx";
import Login from "./Login.jsx";

export default function AuthGate() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <App
      key={user.username}
      loggedInUser={user}
      onLogout={() => setUser(null)}
    />
  );
}
