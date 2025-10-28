"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2 } from "lucide-react";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const raw = await response.text();
      let result: any;
      try {
        result = JSON.parse(raw);
      } catch {
        result = { success: false, message: raw || "Invalid response" };
      }

      if (!response.ok || !result?.success) {
        alert(result?.message || `Login failed (${response.status})`);
        return;
      }

      localStorage.setItem("user_email", email);
      setWelcomeEmail(email);
      setIsSuccess(true);

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (err) {
      console.error("Login failed:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-green-700 mb-2">Login Successful!</h2>
            <p className="text-lg text-gray-700 mb-4">
              Welcome, <span className="font-semibold text-blue-600">{welcomeEmail}</span>!
            </p>
            <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Forgot Password Styling Section ---
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="mb-4">
                <img src="/assets/logos/unis-logo.svg" alt="UNIS Logo" className="mx-auto h-16 w-auto" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Bill Management System</h1>
            </div>
            <ForgotPasswordForm onBack={handleBackToLogin} />
          </div>
        </div>
      </div>
    );
  }

  // --- Default Login Page ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mb-4">
              <img src="/assets/logos/unis-logo.svg" alt="UNIS Logo" className="mx-auto h-16 w-auto" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Bill Management System</h1>
          </div>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center text-cyan-500">Sign In</CardTitle>
              <CardDescription className="text-center text-gray-500">
                Enter your email and password to access your account
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-2 flex items-center text-sm text-gray-500"
                      tabIndex={-1}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                  disabled={isLoading || !email || !password}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Forgot your password?
                </button>
              </div>

              <div className="mt-6 text-center text-sm text-gray-500">
                If you cannot access, please contact your administrator for help.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
