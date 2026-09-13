import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installFocusInteractionGuard } from "./shared/interaction";

installFocusInteractionGuard(document);

console.info("[eversoul-frontend] main:render:start");
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
console.info("[eversoul-frontend] main:render:submitted");
