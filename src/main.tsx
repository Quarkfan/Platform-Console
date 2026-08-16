import React from "react";
import ReactDOM from "react-dom/client";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { App } from "./App";
import "./styles.css";
const notify = (kind: "success" | "error", message: string) =>
  window.dispatchEvent(
    new CustomEvent("qft-operation", { detail: { kind, message } }),
  );
const client = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => notify("success", "操作已完成"),
    onError: (error) =>
      notify("error", error instanceof Error ? error.message : "操作失败"),
  }),
  defaultOptions: { queries: { refetchInterval: 15000, retry: 1 } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
