import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute, PublicOnlyRoute } from "./routes/ProtectedRoute";
import { ThemeProvider } from "./context/ThemeContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import BoardPage from "./pages/BoardPage";
import MyTasks from "./pages/MyTasks";
import Calendar from "./pages/Calendar";
import Team from "./pages/Team";
import Archive from "./pages/Archive";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/layout/AppLayout";
import Analytics from "./pages/Analytics";

// Pametno preusmjeravanje sa korijena u zavisnosti od sesije
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/pocetna" : "/prijava"} replace />;
};

// Preusmjeravanje sa parametrima za stare rute
const RedirectBoardParam = () => {
  const { boardId } = useParams();
  return <Navigate to={`/rad/${boardId}`} replace />;
};

// Animirani omotač ruta za mekan prelaz stranica na mobilnom i desktopu
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="h-full w-full animate-in fade-in-50 slide-in-from-bottom-2 duration-300 ease-out">
      <Routes location={location}>
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/prijava"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/registracija"
          element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/pocetna" element={<Dashboard />} />
          <Route path="/analitika" element={<Analytics />} />
          <Route path="/pacijenti" element={<MyTasks />} />
          <Route path="/arhiva" element={<Archive />} />
          <Route path="/kalendar" element={<Calendar />} />
          <Route path="/zaposleni" element={<Team />} />
          <Route path="/podesavanja" element={<Settings />} />
          <Route path="/rad/:boardId" element={<BoardPage />} />
        </Route>

        <Route path="/login" element={<Navigate to="/prijava" replace />} />
        <Route path="/register" element={<Navigate to="/registracija" replace />} />
        <Route path="/dashboard" element={<Navigate to="/pocetna" replace />} />
        <Route path="/my-tasks" element={<Navigate to="/pacijenti" replace />} />
        <Route path="/archive" element={<Navigate to="/arhiva" replace />} />
        <Route path="/calendar" element={<Navigate to="/kalendar" replace />} />
        <Route path="/team" element={<Navigate to="/zaposleni" replace />} />
        <Route path="/settings" element={<Navigate to="/podesavanja" replace />} />
        <Route path="/board/:boardId" element={<RedirectBoardParam />} />

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <AnimatedRoutes />

        <Toaster
          position="bottom-right"
          gutter={8}
          containerStyle={{
            bottom: 24,
            right: 24,
          }}
          toastOptions={{
            duration: 3500,
            className: "!font-sans !select-none",
            style: {
              background: "var(--color-surface, #ffffff)",
              color: "var(--color-ink, #16161d)",
              border: "1px solid var(--color-line, #e9e8f3)",
              borderRadius: "9999px",
              padding: "8px 16px",
              boxShadow: "var(--shadow-lift, 0 12px 32px -4px rgba(28, 27, 64, 0.12))",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            },
            success: {
              iconTheme: {
                primary: "#246646",
                secondary: "#ffffff",
              },
              style: {
                borderColor: "rgba(36, 102, 70, 0.2)",
              },
            },
            error: {
              iconTheme: {
                primary: "#e11d48",
                secondary: "#ffffff",
              },
              style: {
                borderColor: "rgba(225, 29, 72, 0.2)",
              },
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;