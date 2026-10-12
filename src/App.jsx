import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Portfolio from "./pages/Portfolio";

const AdminPage = lazy(() => import("./components/admin/AdminPage"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/admin-portal" element={<Suspense fallback={<div className="admin-login">Loading admin portal…</div>}><AdminPage /></Suspense>} />
      </Routes>
    </BrowserRouter>
  );
}
