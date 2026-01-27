import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme before rendering to avoid flash and ensure variables apply globally.
const savedTheme = (localStorage.getItem("brokia-theme") as "dark" | "light" | "blue" | null) ?? "dark";
document.documentElement.classList.remove("dark", "light", "blue");
document.body.classList.remove("dark", "light", "blue");
document.documentElement.classList.add(savedTheme);

createRoot(document.getElementById("root")!).render(
  <App />
);
