"use client"

import { useState, FormEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react"

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  // simple strength calc
  const strength = (() => {
    let s = 0
    if (newPassword.length >= 8) s++
    if (/[A-Z]/.test(newPassword)) s++
    if (/[a-z]/.test(newPassword)) s++
    if (/\d/.test(newPassword)) s++
    if (/[^A-Za-z0-9]/.test(newPassword)) s++
    return Math.min(s, 5)
  })()

  const passwordsMatch = newPassword === confirmPassword || confirmPassword.length === 0

  const handleReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSuccessMessage("")
    setErrorMessage("")

    if (!email || !newPassword || !confirmPassword) {
      setErrorMessage("Please fill in all fields.")
      return
    }
    if (!passwordsMatch) {
      setErrorMessage("Passwords do not match.")
      return
    }
    if (strength < 3) {
      setErrorMessage("Please choose a stronger password (min 8 characters with a mix of types).")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      })
      const result = await response.json()

      if (!result?.success) {
        setErrorMessage(result?.message || "Password reset failed.")
      } else {
        setSuccessMessage("Password reset successful. You can now log in with your new password.")
        setTimeout(() => (window.location.href = "/login"), 1500)
      }
    } catch (err) {
      console.error(err)
      setErrorMessage("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const strengthColor =
    strength >= 4 ? "bg-emerald-500" : strength === 3 ? "bg-amber-500" : "bg-rose-500"
  const strengthLabel =
    strength >= 4 ? "Strong" : strength === 3 ? "Okay" : strength > 0 ? "Weak" : "—"

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-50 via-white to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border border-gray-100">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email and choose a new password to regain access.
          </p>
        </CardHeader>

        <CardContent>
          {/* banners */}
          {successMessage && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
              <p className="text-sm">{successMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-800">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pr-10 h-10"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* strength meter */}
              <div className="mt-1">
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-1.5 rounded-full ${strengthColor}`}
                    style={{ width: `${(strength / 5) * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Password strength: {strengthLabel}</span>
                  <span>Use upper/lowercase, numbers & symbols</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`pr-10 h-10 ${confirmPassword && !passwordsMatch ? "border-rose-400 focus-visible:ring-rose-400" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!passwordsMatch && confirmPassword.length > 0 && (
                <p className="text-xs text-rose-600">Passwords do not match.</p>
              )}
            </div>

            <Button type="submit" className="w-full h-10" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Resetting…
                </>
              ) : (
                "Reset Password"
              )}
            </Button>

            <div className="text-center">
              <a
                href="/login"
                className="text-sm text-primary hover:underline"
              >
                Back to login
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
