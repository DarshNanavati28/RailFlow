
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>
);
