import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme before rendering to avoid flash. The ThemeProvider
// refines this after mount (reading the user's saved preference from DB).
// "partner" is normalized to "dark" for the initial class — the provider
// applies the partner branding's actual mode once it hydrates.
const savedTheme = localStorage.getItem("brokia-theme") ?? "dark";
const initialClass =
  savedTheme === "light" ? "light" : savedTheme === "blue" ? "blue" : "dark";
document.documentElement.classList.remove("dark", "light", "blue");
document.body.classList.remove("dark", "light", "blue");
document.documentElement.classList.add(initialClass);
document.body.classList.add(initialClass);

// Unregister any previously installed service workers (push notifications removed)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister().catch(() => {}));
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <App />
);
