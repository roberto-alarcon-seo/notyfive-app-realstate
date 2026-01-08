import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme before rendering to avoid flash and ensure variables apply globally.
const savedTheme = (localStorage.getItem("notyfive-theme") as "dark" | "light" | null) ?? "dark";
document.documentElement.classList.remove("dark", "light");
document.body.classList.remove("dark", "light");
document.documentElement.classList.add(savedTheme);

createRoot(document.getElementById("root")!).render(
  <App />
);

