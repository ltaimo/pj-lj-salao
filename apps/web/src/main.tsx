import React from "react";
import ReactDOM from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

const queryClient = new QueryClient({mutationCache: new MutationCache({
  onError: error => window.dispatchEvent(new CustomEvent("operation-message", {detail: error.message})),
  onSuccess: () => window.dispatchEvent(new CustomEvent("operation-message", {detail: "Operação concluída."}))
})});

if ("serviceWorker" in navigator) {
  if (import.meta.env.DEV) {
    void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.map(r => r.unregister())));
  } else {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
