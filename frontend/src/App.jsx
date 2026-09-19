import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ApplicationFormPage from './pages/ApplicationFormPage'
import ApplicationDetailPage from './pages/ApplicationDetailPage'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage'
import AdminApplicationDetailPage from './pages/admin/AdminApplicationDetailPage'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return !user ? children : <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Farmer routes */}
      <Route path="/dashboard"         element={<PrivateRoute><Layout><DashboardPage /></Layout></PrivateRoute>} />
      <Route path="/apply"             element={<PrivateRoute><Layout><ApplicationFormPage /></Layout></PrivateRoute>} />
      <Route path="/applications/:id"  element={<PrivateRoute><Layout><ApplicationDetailPage /></Layout></PrivateRoute>} />

      {/* Admin routes */}
      <Route path="/admin"                      element={<AdminRoute><AdminLayout><AdminDashboardPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/applications"         element={<AdminRoute><AdminLayout><AdminApplicationsPage /></AdminLayout></AdminRoute>} />
      <Route path="/admin/applications/:id"     element={<AdminRoute><AdminLayout><AdminApplicationDetailPage /></AdminLayout></AdminRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
