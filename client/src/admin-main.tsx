import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import AdminPanel from "./pages/AdminPanel";
import "./index.css";
import "./admin.css";

createRoot(document.getElementById("root")!).render(
  <>
    <AdminPanel />
    <Toaster />
  </>
);
