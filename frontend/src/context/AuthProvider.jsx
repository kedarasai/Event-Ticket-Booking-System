import { useState, useEffect, useCallback, useTransition } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from './AuthContext'
import {
  TOKEN_STORAGE_KEY,
  me as apiMe,
  login as apiLogin,
  register as apiRegister,
  setUnauthorizedHandler
} from '../services/api'
import { useToast } from '../components/ui/useToast'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null
  })
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => {
    const initialToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null
    return initialToken ? 'loading' : 'anonymous'
  })

  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [, startTransition] = useTransition()

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setStatus('anonymous')
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const data = await apiLogin({ email, password })
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    startTransition(() => {
      setToken(data.token)
      setUser(data.user)
      setStatus('authenticated')
    })
    return data
  }, [])

  const register = useCallback(async ({ name, email, password }) => {
    const data = await apiRegister({ name, email, password })
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    startTransition(() => {
      setToken(data.token)
      setUser(data.user)
      setStatus('authenticated')
    })
    return data
  }, [])

  // Wire unauthorized 401 callback with API service
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
      if (location.pathname !== '/login') {
        toast.error('Your session has expired. Please log in again.', 'Session Expired')
        navigate('/login', { replace: true, state: { from: location } })
      }
    })

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [logout, navigate, location, toast])

  // Startup token validation via /auth/me (StrictMode-safe)
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!storedToken) {
      return
    }

    const controller = new AbortController()

    apiMe(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setUser(data.user)
          setStatus('authenticated')
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setStatus('anonymous')
      })

    return () => {
      controller.abort()
    }
  }, [token])

  // Sync logout across tabs using the window storage event
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === TOKEN_STORAGE_KEY && !e.newValue) {
        setToken(null)
        setUser(null)
        setStatus('anonymous')
      } else if (e.key === TOKEN_STORAGE_KEY && e.newValue && e.newValue !== token) {
        setToken(e.newValue)
        setStatus('loading')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        status,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
