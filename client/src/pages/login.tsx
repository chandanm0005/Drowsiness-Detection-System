import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type AuthConfigResponse = {
  googleConfigured: boolean;
  demoAuthEnabled: boolean;
  localAuthEnabled: boolean;
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { isLoading, isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [authConfig, setAuthConfig] = useState<AuthConfigResponse | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localAuthError, setLocalAuthError] = useState<string | null>(null);
  const [localAuthLoading, setLocalAuthLoading] = useState(false);
  const errorParam = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("error")
    : null;

  const errorMessage = (() => {
    if (!errorParam) return null;
    if (errorParam === "google_not_configured") {
      return "Google sign-in is not configured on the server yet.";
    }
    if (errorParam === "google_auth_failed") {
      return "Google authentication failed. Please try again.";
    }
    return "Sign-in could not be completed. Please try again.";
  })();

  useEffect(() => {
    const loadConfig = async () => {
      const res = await fetch("/api/auth/config", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as AuthConfigResponse;
      setAuthConfig(data);
    };

    loadConfig();
  }, []);

  const handleGoogleSignIn = () => {
    const next = encodeURIComponent("/builder");
    window.location.href = `/api/auth/google?next=${next}`;
  };

  const handleDemoSignIn = async () => {
    const res = await fetch("/api/auth/dev-login", {
      method: "POST",
      credentials: "include",
    });

    if (res.ok) {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/builder");
    }
  };

  const handleLocalAuth = async () => {
    setLocalAuthError(null);

    if (!email.trim() || !password) {
      setLocalAuthError("Please enter your email and password.");
      return;
    }

    if (authMode === "register" && password.length < 8) {
      setLocalAuthError("Password must be at least 8 characters.");
      return;
    }

    setLocalAuthLoading(true);
    try {
      const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          displayName,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { message?: string };

      if (!res.ok) {
        setLocalAuthError(payload.message || "Authentication failed. Please try again.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/builder");
    } finally {
      setLocalAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10 flex items-center justify-center">
        <Card className="w-full max-w-md glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl font-mono">Sign In</CardTitle>
            <CardDescription>
              Continue with Google or email/password to save and manage your Drowsiness Detection System sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <p className="text-sm text-muted-foreground">
                Checking your session...
              </p>
            )}

            {!isLoading && isAuthenticated && (
              <div className="space-y-3">
                <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
                  Signed in as {user?.displayName || user?.email || "your account"}.
                </p>
                <Button className="w-full" onClick={() => setLocation("/drowsiness")}>
                  Go to Drowsiness Detector
                </Button>
                <Button variant="outline" className="w-full" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            )}

            {!isLoading && !isAuthenticated && (
              <>
            {authConfig?.localAuthEnabled && (
              <div className="space-y-3 rounded-md border border-white/10 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={authMode === "login" ? "default" : "outline"}
                    onClick={() => setAuthMode("login")}
                  >
                    Email Sign In
                  </Button>
                  <Button
                    type="button"
                    variant={authMode === "register" ? "default" : "outline"}
                    onClick={() => setAuthMode("register")}
                  >
                    Register
                  </Button>
                </div>

                {authMode === "register" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName">Name</Label>
                    <Input
                      id="displayName"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {localAuthError && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                    {localAuthError}
                  </p>
                )}

                <Button className="w-full" onClick={handleLocalAuth} disabled={localAuthLoading}>
                  {localAuthLoading
                    ? "Please wait..."
                    : authMode === "register"
                      ? "Create Account"
                      : "Sign In with Email"}
                </Button>
              </div>
            )}

            {errorMessage && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {errorMessage}
              </p>
            )}
            <Button className="w-full" onClick={handleGoogleSignIn} disabled={!authConfig?.googleConfigured}>
              Continue with Google
            </Button>
            {authConfig?.demoAuthEnabled && !authConfig?.googleConfigured && (
              <Button variant="outline" className="w-full" onClick={handleDemoSignIn}>
                Continue in Demo Mode
              </Button>
            )}
              </>
            )}
            {!authConfig?.googleConfigured && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Google login is disabled because GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured on the server.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
