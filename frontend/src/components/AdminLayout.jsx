import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  ShieldAlert, LayoutDashboard, ListFilter, LogOut,
  User, ChevronRight, BarChart2, ClipboardList, ShieldCheck, ExternalLink
} from 'lucide-react'

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => { logout(); navigate('/login') }

  const navLinks = [
    { to: '/admin',              icon: LayoutDashboard, label: 'Overview' },
    { to: '/admin/applications', icon: ListFilter,      label: 'Applications Review' },
    { to: '/admin/audit-logs',   icon: ClipboardList,   label: 'Audit Trail' },
    { to: '/admin/benchmark',    icon: ShieldCheck,     label: 'AI Benchmark' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Top gov bar */}
      <div className="bg-red-950 text-red-200 py-1.5 px-4 text-xs flex items-center justify-between border-b border-red-900/50">
        <span className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <span>Restricted — Scheme Officer Adjudication Console | Ministry of Agriculture &amp; Farmers Welfare</span>
        </span>
        <span className="hidden sm:block font-mono text-red-300">PM-KISAN Zero-Leak Security Protocol</span>
      </div>

      {/* Admin Header */}
      <header className="bg-gray-900 border-b border-gray-800 shadow-xl">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-3 text-white">
            <div className="bg-red-700 p-2 rounded-lg shadow-md shadow-red-900/50">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold leading-tight text-white">KisanGuard Admin</h1>
                <span className="bg-red-900/60 text-red-300 border border-red-700/50 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Officer Mode
                </span>
              </div>
              <p className="text-gray-400 text-xs">AI Anomaly Detection &amp; Entitlement Adjudication Console</p>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1.5">
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
                      ? 'bg-red-700/80 text-white shadow-sm'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* User + Switcher + logout */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/dashboard?preview=citizen"
              className="hidden lg:flex items-center gap-1.5 bg-blue-950/60 hover:bg-blue-900 text-blue-200 border border-blue-800/60 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              title="Preview citizen portal view"
            >
              <span>🌾 Citizen View</span>
              <ExternalLink className="w-3 h-3 text-blue-400" />
            </Link>

            <div className="hidden sm:flex items-center gap-2 text-gray-400 text-sm bg-gray-800/80 border border-gray-700/60 px-2.5 py-1.5 rounded-lg">
              <User className="w-4 h-4 text-gray-300" />
              <span className="truncate max-w-[130px] text-gray-200 text-xs font-medium">{user?.full_name || user?.email}</span>
              <span className="bg-red-700 text-red-100 text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-red-900/40 text-gray-300 hover:text-red-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-gray-800"
            >
              <LogOut className="w-3.5 h-3.5" />
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
