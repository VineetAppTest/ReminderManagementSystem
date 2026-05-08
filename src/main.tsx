import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Sprint 2B: enable PWA service worker for HTTPS deployment.
// Service workers only work on HTTPS or localhost, so local phone testing over http://192.x will skip this.
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update?.();
      })
      .catch(() => {
        // App continues normally if service worker registration fails.
      });
  });
}
