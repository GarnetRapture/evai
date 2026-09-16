import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeAppHostRuntime } from "./shared/host";
import { installFocusInteractionGuard } from "./shared/interaction";

installFocusInteractionGuard(document);

console.info("[eversoul-frontend] main:runtime:start");
const runtime = await initializeAppHostRuntime();
console.info(`[eversoul-frontend] main:runtime:${runtime.kind}:${runtime.storage}`);
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
console.info("[eversoul-frontend] main:render:submitted");
