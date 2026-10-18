import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OperationsView from "./operations/OperationsView";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OperationsView localPreview />
  </StrictMode>,
);
