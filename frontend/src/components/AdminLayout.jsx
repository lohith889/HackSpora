import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ChatWidget from './ChatWidget'

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => { logout(); navigate('/login') }

  const navLinks = [
    { to: '/admin',              label: 'Dashboard Overview', code: 'SEC-01' },
    { to: '/admin/applications', label: 'Application Claims Ledger', code: 'SEC-02' },
    { to: '/admin/audit-logs',   label: 'Statutory Audit Trail', code: 'SEC-03' },
    { to: '/admin/benchmark',    label: 'AI Model Verification', code: 'SEC-04' },
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
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
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
            <span className="bg-red-50 text-red-800 border border-red-200 px-1.5 py-0.2 font-semibold">
              ● RESTRICTED: OFFICER ACCESS
            </span>
            <span className="hidden sm:inline">GIGW 3.0 Standard</span>
          </div>
        </div>
      </div>

      {/* Official Departmental Masthead */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Ashoka Emblem Representation */}
            <div className="border-r-2 border-slate-300 pr-3.5 text-center font-serif leading-none select-none">
              <div className="text-[12px] font-bold tracking-widest text-slate-800">सत्यमेव जयते</div>
              <div className="text-[8px] uppercase tracking-wider text-slate-500 font-sans mt-0.5 font-bold">Govt. of India</div>
            </div>

            <div>
              <Link to="/admin" className="block text-left group">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    PM-KISAN <span className="text-emerald-800 font-normal">| KisanGuard</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-700 border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-bold">
                    OFFICER CONSOLE
                  </span>
                </div>
                <p className="font-sans text-xs text-slate-600 font-medium">
                  Pradhan Mantri Kisan Samman Nidhi • Central Subsidy Anomaly Detection &amp; Entitlement Adjudication
                </p>
              </Link>
            </div>
          </div>

          {/* Officer Identity & Mode Switcher */}
          <div className="flex items-center gap-3 font-mono text-xs border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
            <Link
              to="/dashboard?preview=citizen"
              className="border border-slate-300 hover:border-slate-800 bg-slate-50 text-slate-800 px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors font-semibold"
              title="Preview Citizen Portal"
            >
              Citizen View →
            </Link>

            <div className="hidden lg:block text-right text-[11px] leading-tight">
              <span className="block font-semibold text-slate-900 truncate max-w-[140px]">
                {user?.full_name || 'Nodal Scheme Officer'}
              </span>
              <span className="text-[10px] text-slate-500 block">DESK: ADJUDICATION</span>
            </div>

            <button
              onClick={handleLogout}
              className="border border-slate-300 hover:border-red-400 hover:bg-red-50 hover:text-red-800 text-slate-700 px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Primary Navigation Ribbon (Institutional Green Bar) */}
        <div className="border-t border-slate-200 bg-emerald-900 text-white">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <nav className="flex items-center overflow-x-auto font-mono text-xs uppercase tracking-wider">
              {navLinks.map(({ to, label, code }) => {
                const isActive = to === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(to)
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap font-medium flex items-center gap-1.5 ${
                      isActive
                        ? 'border-white bg-emerald-950 text-white font-bold'
                        : 'border-transparent text-emerald-100 hover:bg-emerald-800 hover:text-white'
                    }`}
                  >
                    <span className="text-emerald-300 text-[10px]">{code}</span>
                    <span>{label}</span>
                  </Link>
                )
              })}
            </nav>

            <span className="hidden md:inline font-mono text-[10px] text-emerald-200 uppercase tracking-widest">
              NIC SUB-REGISTRY // PS-03
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Formal Government Statutory Footer */}
      <footer className="border-t border-slate-300 bg-white py-6 px-4 font-mono text-xs text-slate-600 mt-auto">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 text-[11px]">
            <div>
              <span className="font-bold text-slate-900">PRADHAN MANTRI KISAN SAMMAN NIDHI (PM-KISAN)</span>
              <span className="block text-slate-500 font-sans text-xs mt-0.5">
                Department of Agriculture and Farmers Welfare, Ministry of Agriculture &amp; Farmers Welfare, Krishi Bhawan, New Delhi
              </span>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] text-slate-600">
              <span>OFFICIAL GAZETTE CODE: SEC-4-ANOMALY-AUDIT</span>
              <span className="block text-slate-500">DIGITAL PERSONAL DATA PROTECTION COMPLIANT</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-slate-500 font-sans">
            <p>
              Designed, Developed and Hosted by <strong>National Informatics Subsystem</strong> for Department of Agriculture &amp; Farmers Welfare, Government of India.
            </p>
            <p className="font-mono">
              National Helpline: <strong>155261</strong> / <strong>011-24300606</strong> (Toll Free: <strong>1800-115-526</strong>)
            </p>
          </div>
        </div>
      </footer>
      <ChatWidget />
    </div>
  )
}
