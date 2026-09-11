import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.info("[eversoul-frontend] main:render:start");
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
console.info("[eversoul-frontend] main:render:submitted");
