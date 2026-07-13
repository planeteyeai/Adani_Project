import { Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import MapExplorer from "./pages/MapExplorer";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";

function ScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [hash, pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const isExplorer = pathname === "/explorer";
  return (
    <div className="min-h-screen">
      <ScrollToHash />
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/explorer" element={<MapExplorer />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
      </Routes>
      {!isExplorer && <Footer />}
    </div>
  );
}
