import "./styles/base.css";
import React from "react";
import { createRoot } from "react-dom/client";
import RootApp from "./RootApp.jsx";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<RootApp />);
