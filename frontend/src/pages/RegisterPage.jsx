import { useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { UserIcon, LockIcon, ArrowRightIcon, AlertCircleIcon, CheckIcon } from '../components/ui/Icons'

export default function RegisterPage() {
  useDocumentTitle('Create Account | TicketFlow')

  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const nameRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const confirmPasswordRef = useRef(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false
  })
  const [inlineErrors, setInlineErrors] = useState({
    name: null,
    email: null,
    password: null,
    confirmPassword: null
  })
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)

  const destination = location.state?.from?.pathname || location.state?.from || '/'

  // Password checklist conditions
  const hasMinLength = password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const strengthScore = (hasMinLength ? 1 : 0) + (hasLetter ? 1 : 0) + (hasNumber ? 1 : 0)
  const strengthPercent = strengthScore === 0 ? 0 : Math.round((strengthScore / 3) * 100)
  const strengthColor =
    strengthScore === 3
      ? 'var(--success)'
      : strengthScore === 2
      ? 'var(--gold)'
      : 'var(--danger)'

  // Field validation functions
  const validateName = (val) => {
    const trimmed = (val || '').trim()
    if (!trimmed) return 'Full name is required.'
    if (trimmed.length < 2 || trimmed.length > 100) {
      return 'Name must be between 2 and 100 characters.'
    }
    return null
  }

  const validateEmail = (val) => {
    const trimmed = (val || '').trim()
    if (!trimmed) return 'Email address is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Please provide a valid email address.'
    }
    return null
  }

  const validatePassword = (val) => {
    if (!val) return 'Password is required.'
    if (val.length < 8) return 'Password must be at least 8 characters long.'
    if (!/[a-zA-Z]/.test(val) || !/[0-9]/.test(val)) {
      return 'Password must contain at least one letter and one number.'
    }
    return null
  }

  const validateConfirmPassword = (val, currentPass) => {
    if (!val) return 'Please confirm your password.'
    if (val !== currentPass) return 'Passwords do not match.'
    return null
  }

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    if (field === 'name') {
      setInlineErrors((prev) => ({ ...prev, name: validateName(name) }))
    } else if (field === 'email') {
      setInlineErrors((prev) => ({ ...prev, email: validateEmail(email) }))
    } else if (field === 'password') {
      setInlineErrors((prev) => ({ ...prev, password: validatePassword(password) }))
    } else if (field === 'confirmPassword') {
      setInlineErrors((prev) => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, password) }))
    }
  }

  const handleNameChange = (e) => {
    const val = e.target.value
    setName(val)
    if (serverError) setServerError(null)
    if (touched.name) {
      setInlineErrors((prev) => ({ ...prev, name: validateName(val) }))
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
    if (touched.confirmPassword && confirmPassword) {
      setInlineErrors((prev) => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, val) }))
    }
  }

  const handleConfirmPasswordChange = (e) => {
    const val = e.target.value
    setConfirmPassword(val)
    if (serverError) setServerError(null)
    if (touched.confirmPassword) {
      setInlineErrors((prev) => ({ ...prev, confirmPassword: validateConfirmPassword(val, password) }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const nameErr = validateName(name)
    const emailErr = validateEmail(email)
    const passErr = validatePassword(password)
    const confirmErr = validateConfirmPassword(confirmPassword, password)

    setTouched({ name: true, email: true, password: true, confirmPassword: true })
    setInlineErrors({
      name: nameErr,
      email: emailErr,
      password: passErr,
      confirmPassword: confirmErr
    })

    // Focus the FIRST invalid field
    if (nameErr) {
      nameRef.current?.focus()
      return
    }
    if (emailErr) {
      emailRef.current?.focus()
      return
    }
    if (passErr) {
      passwordRef.current?.focus()
      return
    }
    if (confirmErr) {
      confirmPasswordRef.current?.focus()
      return
    }

    try {
      setLoading(true)
      setServerError(null)

      const newUser = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password
      })

      toast.success(`Welcome to TicketFlow, ${newUser?.name || 'User'}!`, 'Account Created')
      navigate(destination, { replace: true })
    } catch (err) {
      const msg = err.message || 'Registration failed. Please try again.'
      setServerError(msg)
      toast.error(msg, 'Registration Error')

      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('registered')) {
        setInlineErrors((prev) => ({ ...prev, email: msg }))
        emailRef.current?.focus()
      } else if (msg.toLowerCase().includes('password')) {
        setInlineErrors((prev) => ({ ...prev, password: msg }))
        passwordRef.current?.focus()
      } else if (msg.toLowerCase().includes('name')) {
        setInlineErrors((prev) => ({ ...prev, name: msg }))
        nameRef.current?.focus()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create an Account"
      subtitle="Join TicketFlow to book verified seats with zero double-booking."
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
          ref={nameRef}
          id="register-name"
          label="Full Name"
          placeholder="e.g. Jordan Lee"
          icon={<UserIcon size={18} />}
          value={name}
          onChange={handleNameChange}
          onBlur={() => handleBlur('name')}
          error={touched.name ? inlineErrors.name : null}
          autoComplete="name"
          disabled={loading}
          required
        />

        <Input
          ref={emailRef}
          id="register-email"
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={handleEmailChange}
          onBlur={() => handleBlur('email')}
          error={touched.email ? inlineErrors.email : null}
          autoComplete="email"
          disabled={loading}
          required
        />

        <div>
          <Input
            ref={passwordRef}
            id="register-password"
            label="Password"
            type="password"
            placeholder="At least 8 chars with 1 letter & 1 number"
            icon={<LockIcon size={18} />}
            value={password}
            onChange={handlePasswordChange}
            onBlur={() => handleBlur('password')}
            error={touched.password ? inlineErrors.password : null}
            autoComplete="new-password"
            disabled={loading}
            required
          />

          {/* Live strength meter track and animated checklist */}
          {password && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <div className="password-strength-track">
                <div
                  className="password-strength-bar"
                  style={{
                    width: `${strengthPercent}%`,
                    background: strengthColor
                  }}
                />
              </div>

              <div className="password-checklist" aria-live="polite">
                <div className={`checklist-item ${hasMinLength ? 'is-valid' : ''}`}>
                  {hasMinLength ? (
                    <CheckIcon size={14} color="var(--success)" />
                  ) : (
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>○</span>
                  )}
                  <span>At least 8 characters long</span>
                </div>

                <div className={`checklist-item ${hasLetter ? 'is-valid' : ''}`}>
                  {hasLetter ? (
                    <CheckIcon size={14} color="var(--success)" />
                  ) : (
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>○</span>
                  )}
                  <span>Contains at least one letter (a-z, A-Z)</span>
                </div>

                <div className={`checklist-item ${hasNumber ? 'is-valid' : ''}`}>
                  {hasNumber ? (
                    <CheckIcon size={14} color="var(--success)" />
                  ) : (
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>○</span>
                  )}
                  <span>Contains at least one number (0-9)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <Input
          ref={confirmPasswordRef}
          id="register-confirm-password"
          label="Confirm Password"
          type="password"
          placeholder="Re-enter your password"
          icon={<LockIcon size={18} />}
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          onBlur={() => handleBlur('confirmPassword')}
          error={touched.confirmPassword ? inlineErrors.confirmPassword : null}
          autoComplete="new-password"
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
          Create Account
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
          Already have an account?{' '}
        </span>
        <Link
          to="/login"
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
          Sign in here <ArrowRightIcon size={14} />
        </Link>
      </div>
    </AuthLayout>
  )
}
