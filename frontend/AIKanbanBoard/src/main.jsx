import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Sigurno postavljanje preferencija prije prvog renderovanja
try {
  const reducedMotion = localStorage.getItem("pref-reduced-motion");
  if (reducedMotion === "true") {
    document.documentElement.dataset.reduceMotion = "true";
  } else {
    delete document.documentElement.dataset.reduceMotion;
  }
} catch {
  // Ignoriši ukoliko je pristup localStorage onemogućen u browseru
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error("Nije pronađen #root element u HTML dokumentu.");
}