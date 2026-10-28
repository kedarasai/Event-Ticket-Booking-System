import { useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { UserIcon, LockIcon, ArrowRightIcon, AlertCircleIcon } from '../components/ui/Icons'

export default function LoginPage() {
  useDocumentTitle('Log In | TicketFlow')

  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [inlineErrors, setInlineErrors] = useState({ email: null, password: null })
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  const destination = location.state?.from?.pathname || location.state?.from || '/'

  // Field validators
  const validateEmail = (val) => {
    const trimmed = (val || '').trim()
    if (!trimmed) return 'Email address is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Please enter a valid email address.'
    }
    return null
  }

  const validatePassword = (val) => {
    if (!val) return 'Password is required.'
    return null
  }

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    if (field === 'email') {
      setInlineErrors((prev) => ({ ...prev, email: validateEmail(email) }))
    } else if (field === 'password') {
      setInlineErrors((prev) => ({ ...prev, password: validatePassword(password) }))
    }
  }

  const handleEmailChange = (e) => {
    const val = e.target.value
    setEmail(val)
    if (serverError) setServerError(null)
    if (touched.email) {
      setInlineErrors((prev) => ({ ...prev, email: validateEmail(val) }))
    }
  }

  const handlePasswordChange = (e) => {
    const val = e.target.value
    setPassword(val)
    if (serverError) setServerError(null)
    if (touched.password) {
      setInlineErrors((prev) => ({ ...prev, password: validatePassword(val) }))
    }
  }

  const handleUseDemo = () => {
    setEmail('demo@example.com')
    setPassword('Demo@1234')
    setTouched({ email: true, password: true })
    setInlineErrors({ email: null, password: null })
    setServerError(null)
    passwordRef.current?.focus()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const emailErr = validateEmail(email)
    const passErr = validatePassword(password)

    setTouched({ email: true, password: true })
    setInlineErrors({ email: emailErr, password: passErr })

    // Auto-focus first invalid field
    if (emailErr) {
      emailRef.current?.focus()
      return
    }
    if (passErr) {
      passwordRef.current?.focus()
      return
    }

    try {
      setLoading(true)
      setServerError(null)

      const loggedInUser = await login({ email: email.trim(), password })
      toast.success(`Welcome back, ${loggedInUser?.name || 'User'}!`, 'Signed In')
      navigate(destination, { replace: true })
    } catch (err) {
      const msg = err.message || 'Login failed. Please check your credentials.'
      setServerError(msg)
      toast.error(msg, 'Sign In Error')

      // Direct focus according to the error
      if (msg.toLowerCase().includes('password')) {
        passwordRef.current?.focus()
      } else {
        emailRef.current?.focus()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to access your seats and manage bookings."
    >
      {serverError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: '0.875rem',
            marginBottom: 'var(--space-4)'
          }}
        >
          <AlertCircleIcon size={18} />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Input
          ref={emailRef}
          id="login-email"
          label="Email Address"
          type="email"
          placeholder="demo@example.com"
          icon={<UserIcon size={18} />}
          value={email}
          onChange={handleEmailChange}
          onBlur={() => handleBlur('email')}
          error={touched.email ? inlineErrors.email : null}
          autoComplete="email"
          disabled={loading}
          required
        />

        <Input
          ref={passwordRef}
          id="login-password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          icon={<LockIcon size={18} />}
          value={password}
          onChange={handlePasswordChange}
          onBlur={() => handleBlur('password')}
          error={touched.password ? inlineErrors.password : null}
          autoComplete="current-password"
          disabled={loading}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading}
          style={{ width: '100%', marginTop: 'var(--space-2)' }}
        >
          Sign In
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleUseDemo}
          disabled={loading}
          style={{ width: '100%', borderColor: 'var(--border)' }}
        >
          Use demo account
        </Button>
      </form>

      <div
        style={{
          textAlign: 'center',
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--border)'
        }}
      >
        <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
          Don&apos;t have an account yet?{' '}
        </span>
        <Link
          to="/register"
          state={location.state}
          style={{
            fontSize: 'var(--text-small)',
            color: 'var(--accent-cyan)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            textDecoration: 'none'
          }}
        >
          Create an account <ArrowRightIcon size={14} />
        </Link>
      </div>
    </AuthLayout>
  )
}
