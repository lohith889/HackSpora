import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/dashboard', label: 'My Applications' },
    { to: '/apply', label: 'File New Claim' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* 3-Color Subtle National Tri-Band Motif */}
      <div className="h-[3px] w-full flex">
        <div className="h-full w-1/3 bg-[#f97316]"></div>
        <div className="h-full w-1/3 bg-white border-y border-slate-300"></div>
        <div className="h-full w-1/3 bg-[#16a34a]"></div>
      </div>

      {/* Top Government of India Official Utility Ribbon */}
      <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-1.5 font-mono text-[11px] text-slate-700">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-wider">भारत सरकार</span>
            <span className="text-slate-400">|</span>
            <span className="font-semibold text-slate-800">Government of India</span>
            <span className="text-slate-400">|</span>
            <span className="hidden md:inline text-slate-600">कृषि एवं किसान कल्याण मंत्रालय</span>
            <span className="hidden md:inline text-slate-400">|</span>
            <span className="hidden lg:inline text-slate-600">Ministry of Agriculture &amp; Farmers Welfare</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-600 uppercase tracking-wider">
            <span>Direct Benefit Transfer (DBT)</span>
            <span className="text-slate-400">|</span>
            <span>GIGW 3.0 Standard</span>
          </div>
        </div>
      </div>

      {/* Admin Switcher Banner if Officer is in Citizen View */}
      {user?.role === 'ADMIN' && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-1.5 font-mono text-xs text-amber-900 flex items-center justify-between">
          <span className="font-semibold">[OFFICER PRIVILEGE ACTIVE: CITIZEN PREVIEW MODE]</span>
          <Link
            to="/admin"
            className="border border-amber-800 bg-white text-amber-900 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider hover:bg-amber-900 hover:text-white transition-colors font-bold"
          >
            Return to Officer Console →
          </Link>
        </div>
      )}

      {/* Main Departmental Masthead */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Ashoka Emblem Representation */}
            <div className="border-r-2 border-slate-300 pr-3.5 text-center font-serif leading-none select-none">
              <div className="text-[12px] font-bold tracking-widest text-slate-800">सत्यमेव जयते</div>
              <div className="text-[8px] uppercase tracking-wider text-slate-500 font-sans mt-0.5 font-bold">Govt. of India</div>
            </div>

            <div>
              <Link to="/dashboard" className="block text-left group">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    PM-KISAN <span className="text-emerald-800 font-normal">| किसान सम्मान निधि</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-800 border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-bold">
                    CITIZEN PORTAL
                  </span>
                </div>
                <p className="font-sans text-xs text-slate-600 font-medium">
                  Pradhan Mantri Kisan Samman Nidhi • Direct Benefit Transfer &amp; Land Record Verification
                </p>
              </Link>
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4 font-mono text-xs">
            <div className="text-right text-[11px] leading-tight">
              <span className="block font-semibold text-slate-900 truncate max-w-[150px]">
                {user?.full_name || user?.email}
              </span>
              <span className="text-[10px] text-slate-500 block">AUTHENTICATED CULTIVATOR</span>
            </div>
            <button
              onClick={handleLogout}
              className="border border-slate-300 hover:border-red-400 hover:bg-red-50 hover:text-red-800 text-slate-700 px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors font-semibold"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Primary Navigation Ribbon (Institutional Green Bar) */}
        <div className="border-t border-slate-200 bg-emerald-900 text-white">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
            <nav className="flex items-center font-mono text-xs uppercase tracking-wider">
              {navLinks.map(({ to, label }) => {
                const isActive = location.pathname === to
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-4 py-2.5 border-b-2 transition-colors font-medium ${
                      isActive
                        ? 'border-white bg-emerald-950 text-white font-bold'
                        : 'border-transparent text-emerald-100 hover:bg-emerald-800 hover:text-white'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>

            <span className="hidden sm:inline font-mono text-[10px] text-emerald-200 uppercase tracking-widest">
              HELP: 155261 (TOLL FREE)
            </span>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Formal Government Statutory Footer */}
      <footer className="border-t border-slate-300 bg-white py-6 px-4 font-mono text-xs text-slate-600 mt-auto">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 text-[11px]">
            <div>
              <span className="font-bold text-slate-900">PRADHAN MANTRI KISAN SAMMAN NIDHI (PM-KISAN)</span>
              <span className="block text-slate-500 font-sans text-xs mt-0.5">
                Department of Agriculture and Farmers Welfare, Ministry of Agriculture &amp; Farmers Welfare, Krishi Bhawan, New Delhi
              </span>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] text-slate-600">
              <span>BHULEKH &amp; PFMS VERIFICATION PROTOCOL</span>
              <span className="block text-slate-500">DIGITAL PERSONAL DATA PROTECTION COMPLIANT</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-slate-500 font-sans">
            <p>
              Website Content Managed by <strong>Ministry of Agriculture &amp; Farmers Welfare</strong>, Government of India.
            </p>
            <p className="font-mono">
              PM-KISAN Helpline: <strong>155261</strong> / <strong>011-24300606</strong> (Toll Free: <strong>1800-115-526</strong>)
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
