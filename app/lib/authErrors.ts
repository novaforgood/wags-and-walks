/** Human-readable copy for Firebase Auth errors — consistent tone across login, signup, forgot password. */

export const AUTH_VALIDATION = {
  passwordMismatch: "Those passwords don't match. Please enter the same password twice.",
  passwordTooShort: 'Use at least 6 characters for your password.',
} as const

function firebaseCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code: string }).code)
  }
  return undefined
}

type AuthContext = 'signIn' | 'signUp' | 'resetPassword'

const SIGN_IN: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact an administrator.',
  'auth/user-not-found': 'No account exists with this email. Complete sign-up first or check the address.',
  'auth/wrong-password': "That password isn't correct. Try again or use Forgot password.",
  'auth/invalid-credential': "Email or password doesn't match our records. Try again or use Forgot password.",
  'auth/too-many-requests': 'Too many sign-in attempts. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': "Email/password sign-in isn't enabled for this project. Contact an administrator.",
}

const SIGN_UP: Record<string, string> = {
  'auth/email-already-in-use': 'An account already exists with this email. Sign in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a stronger password (longer mix of characters).',
  'auth/operation-not-allowed': "Sign-up isn't available right now. Contact an administrator.",
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
}

const RESET: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-email': 'Enter the email address for your account.',
  'auth/user-not-found': "If an account exists for this email, you'll get reset instructions.",
  'auth/too-many-requests': 'Too many requests. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/unauthorized-continue-uri':
    "Reset link's redirect URL isn't authorized in Firebase. Add this site's domain under Authentication → Settings → Authorized domains.",
  'auth/invalid-continue-uri':
    "The redirect URL Firebase received is invalid. Update Authentication → Settings → Authorized domains.",
  'auth/missing-android-pkg-name':
    'Firebase password-reset is misconfigured (missing Android package name). Contact an administrator.',
  'auth/missing-continue-uri':
    'Firebase password-reset is misconfigured (missing continue URL). Contact an administrator.',
  'auth/operation-not-allowed':
    "Password reset isn't enabled for this Firebase project. Enable Email/Password in Authentication → Sign-in method.",
}

const GENERIC = 'Something went wrong. Please try again.'

export function getAuthErrorMessage(err: unknown, context: AuthContext): string {
  const code = firebaseCode(err)
  const map =
    context === 'signIn' ? SIGN_IN : context === 'signUp' ? SIGN_UP : RESET
  if (code && map[code]) return map[code]

  // Access denied from app logic (allowlist)
  if (err instanceof Error) {
    const m = err.message
    if (m.includes("don't have access") || m.includes('do not have access')) {
      return "Your email isn't authorized for this portal. Contact an administrator to be added."
    }
    if (m.includes('not approved')) {
      return "Your email hasn't been approved yet. Ask an administrator to add you, then try again."
    }
    if (m && !m.startsWith('Firebase:')) return m
  }

  // Surface the raw Firebase code if we have one — much easier to diagnose
  // than a generic "Something went wrong."
  if (code) return `${GENERIC} (${code})`
  return GENERIC
}
