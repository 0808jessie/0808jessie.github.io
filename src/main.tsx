import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import DecideNow from "./routes/index"; // 移除大括號，這樣就是讀取 default export
import "./styles.css";
import App from "./routes/index";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DecideNow />
  </StrictMode>,
);
