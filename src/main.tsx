import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { DecideNow } from "./routes/index";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DecideNow />
  </StrictMode>,
);
