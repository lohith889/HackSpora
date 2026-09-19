import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('kg_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)

  // Persist user across reloads (AUTH-04)
  useEffect(() => {
    if (user) {
      localStorage.setItem('kg_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('kg_user')
    }
  }, [user])

  const login = async (email, password) => {
    setLoading(true)
    try {
      const { data } = await authAPI.login({ email, password })
      localStorage.setItem('kg_token', data.access_token)
      setUser(data.user)
      return { success: true, user: data.user }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Login failed. Please try again.'
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  const register = async (payload) => {
    setLoading(true)
    try {
      const { data } = await authAPI.register(payload)
      localStorage.setItem('kg_token', data.access_token)
      setUser(data.user)
      return { success: true, user: data.user }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Registration failed. Please try again.'
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('kg_token')
    localStorage.removeItem('kg_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
