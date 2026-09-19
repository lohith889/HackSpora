import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  ShieldAlert, LayoutDashboard, ListFilter, LogOut,
  User, ChevronRight, BarChart2
} from 'lucide-react'

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => { logout(); navigate('/login') }

  const navLinks = [
    { to: '/admin',              icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/applications', icon: ListFilter,      label: 'Applications' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Top gov bar */}
      <div className="bg-red-950 text-red-200 py-1 px-4 text-xs flex items-center justify-between">
        <span>🔒 Restricted — Scheme Officer Console | KisanGuard Administration</span>
        <span className="hidden sm:block">Ministry of Agriculture &amp; Farmers Welfare</span>
      </div>

      {/* Admin Header */}
      <header className="bg-gray-900 border-b border-gray-800 shadow-xl">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-3 text-white">
            <div className="bg-red-700 p-2 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">KisanGuard Admin</h1>
              <p className="text-gray-400 text-xs">Anomaly Detection &amp; Review Console</p>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, icon: Icon, label }) => {
              const isActive = to === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-gray-400 text-sm">
              <User className="w-4 h-4" />
              <span className="truncate max-w-[140px]">{user?.full_name || user?.email}</span>
              <span className="bg-red-700 text-red-100 text-xs px-2 py-0.5 rounded-full font-medium">ADMIN</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-gray-800 px-4 py-2 flex gap-2">
          {navLinks.map(({ to, icon: Icon, label }) => {
            const isActive = to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-1.5 text-xs text-gray-500">
          <BarChart2 className="w-3 h-3" />
          <span>Admin Console</span>
          {location.pathname !== '/admin' && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-300">
                {location.pathname.includes('/applications/') && !location.pathname.endsWith('/applications')
                  ? 'Application Detail'
                  : 'Applications'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="bg-gray-900 border-t border-gray-800 text-gray-600 text-xs text-center py-3">
        KisanGuard Admin Console — Internal Use Only — Unauthorized access is prohibited
      </footer>
    </div>
  )
}
