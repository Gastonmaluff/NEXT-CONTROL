import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter
      basename={basename}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
