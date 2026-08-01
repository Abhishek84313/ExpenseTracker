import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";

function Main() {

  return (
    <AuthProvider>
      <App/>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Main />);
