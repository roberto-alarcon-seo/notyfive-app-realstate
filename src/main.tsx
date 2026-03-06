import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerSW";

// Initialize theme before rendering to avoid flash and ensure variables apply globally.
const savedTheme = (localStorage.getItem("brokia-theme") as "dark" | "light" | "blue" | null) ?? "dark";
document.documentElement.classList.remove("dark", "light", "blue");
document.body.classList.remove("dark", "light", "blue");
document.documentElement.classList.add(savedTheme);

// Register PWA service worker
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <App />
);
