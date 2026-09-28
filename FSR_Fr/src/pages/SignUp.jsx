import { useState } from "react";
import icon from "../assets/logo.png"


export default function SignupPage({ onSignup }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    try {
      setLoading(true);

      await onSignup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
      });

      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Could not create your account.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06111d] px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-cyan-400/20 bg-[#0b1b2b] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-3xl text-cyan-400">
            ✓
          </div>

          <h1 className="text-2xl font-bold text-white">
            Signup request submitted
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            Your account is waiting for admin approval. You can use the site
            after the admin approves your request.
          </p>

          <a
            href="/login"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#00A0D2] px-5 py-3 font-semibold text-white transition hover:bg-[#008db9]"
          >
            Back to login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06111d] px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
         <div className="mx-auto flex h-10 w-36 items-center justify-center sm:h-10 sm:w-50">
           <img
             src={icon}
             alt="Logo"
             className="h-full w-full object-contain"
           />
         </div>
                  </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-[#0b1b2b] p-6 shadow-2xl sm:p-8">
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="mt-2 text-sm text-slate-400">
            Request access to the Field Service Report system.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-slate-700 bg-[#071421] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#00A0D2]"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-700 bg-[#071421] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#00A0D2]"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Mobile number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter your mobile number"
                className="w-full rounded-xl border border-slate-700 bg-[#071421] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#00A0D2]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-slate-700 bg-[#071421] px-4 py-3 pr-16 text-white outline-none placeholder:text-slate-500 focus:border-[#00A0D2]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 text-xs font-medium text-[#00A0D2]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Enter password again"
                className="w-full rounded-xl border border-slate-700 bg-[#071421] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-[#00A0D2]"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !onSignup}
              className="w-full rounded-xl bg-[#00A0D2] px-5 py-3 font-semibold text-white transition hover:bg-[#008db9] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Submitting request..." : "Request access"}
            </button>

            {!onSignup && (
              <p className="text-center text-xs text-amber-300">
                Connect the signup handler to enable this form.
              </p>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <a
              href="/login"
              className="font-semibold text-[#00A0D2] hover:underline"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
