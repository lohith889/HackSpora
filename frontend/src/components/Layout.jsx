import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Leaf, LayoutDashboard, FilePlus, LogOut, User } from 'lucide-react'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'My Dashboard' },
    { to: '/apply', icon: FilePlus, label: 'Apply for PM-KISAN' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Government Header Bar */}
      <div className="bg-gov-navy text-white py-1 px-4 text-xs flex items-center justify-between">
        <span>Government of India | Ministry of Agriculture &amp; Farmers Welfare</span>
        <span className="hidden sm:block">Digital India • Kisan Kalyan</span>
      </div>

      {/* Main Header */}
      <header className="bg-gov-blue shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3 text-white">
            <div className="bg-gov-green p-2 rounded-lg">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">KisanGuard Portal</h1>
              <p className="text-blue-200 text-xs">PM-KISAN Scheme Application System</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            {navLinks.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-blue-100 text-sm">
              <User className="w-4 h-4" />
              <span className="max-w-[140px] truncate">{user?.full_name || user?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden border-t border-white/10 px-4 py-2 flex gap-2">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center transition-colors ${
                location.pathname === to
                  ? 'bg-white/20 text-white'
                  : 'text-blue-100 hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gov-navy text-blue-200 text-xs text-center py-3 mt-auto">
        <p>© 2024 KisanGuard Portal | Ministry of Agriculture &amp; Farmers Welfare, Government of India</p>
        <p className="mt-0.5">For helpline: 155261 | Email: pmkisan-ict@gov.in</p>
      </footer>
    </div>
  )
}
