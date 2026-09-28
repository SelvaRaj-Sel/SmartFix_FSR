import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import './App.css'
import LoginPage from './pages/LoginPage'
import FieldServiceReport from './components/FieldServiceReport'
import SignupPage from './pages/SignUp'
import AdminUsersPage from './pages/AdminUsersPage'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
async function signup(form) {
  const response = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not create your account');
}
function ProtectedPage({ role, children }) {
  let user;
  try { user = JSON.parse(localStorage.getItem('smartfix_user')); }
  catch { return <Navigate to="/login" replace />; }
  if (!localStorage.getItem('smartfix_auth_token') || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage onSignup={signup} />} />
        <Route path="/admin" element={<ProtectedPage role="admin"><AdminUsersPage /></ProtectedPage>} />
        <Route path="/dashboard" element={<ProtectedPage><FieldServiceReport /></ProtectedPage>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
