import { useState } from "react";
import { Link, useNavigate } from "react-router";
import icon from "../assets/logo.png";

const API_BASE =
  import.meta.env.VITE_API_URL

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to sign in");
      }

      if (!data.token || !data.user?.role) {
        throw new Error("Invalid login response from server");
      }

      localStorage.setItem("smartfix_auth_token", data.token);
      localStorage.setItem("smartfix_user", JSON.stringify(data.user));

      if (data.user.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06111d] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1c2b] p-6 shadow-2xl shadow-black/30 sm:p-9">
        <div className="mb-9 text-center">
          <div className="mx-auto mb-2 flex h-10 w-36 items-center justify-center sm:h-12 sm:w-45">
            <img
              src={icon}
              alt="Smartfix Automation"
              className="h-full w-full object-contain"
            />
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Sign in to continue to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#00A0D2] focus:ring-2 focus:ring-[#00A0D2]/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-16 text-white outline-none placeholder:text-slate-500 focus:border-[#00A0D2] focus:ring-2 focus:ring-[#00A0D2]/20"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-4 text-sm text-[#00A0D2] hover:text-cyan-300"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#00A0D2] px-4 py-3 font-semibold text-[#06111d] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-5 flex justify-center gap-2 text-sm">
          <span className="text-slate-400">
            Don&apos;t have an account?
          </span>

          <Link
            to="/signup"
            className="font-semibold text-[#00A0D2] hover:text-cyan-300"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}