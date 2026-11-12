import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { wakeServer } from "./services/api";
import "./index.css";

wakeServer();
createRoot(document.getElementById("root")!).render(<App />);
