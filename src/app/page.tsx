
"use client";

import { useState, FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { auth, db } from "@/lib/firebase";

type AuthMode = "login" | "register";

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const resetForm = (newMode: AuthMode) => {
    setMode(newMode);
    setMessage("");
    setSuccess(false);
    setPassword("");
    setConfirmPassword("");
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case "auth/email-already-in-use":
          return "This email is already registered. Please sign in.";
        case "auth/invalid-email":
          return "Please enter a valid email address.";
        case "auth/weak-password":
          return "Password should contain at least 6 characters.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          return "Incorrect email or password.";
        case "auth/too-many-requests":
          return "Too many attempts. Please try again later.";
        case "auth/network-request-failed":
          return "Network error. Please check your internet connection.";
        default:
          return error.message;
      }
    }
    return "Something went wrong. Please try again.";
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setSuccess(false);

    if (mode === "register") {
      if (!name.trim()) {
        setMessage("Please enter your full name.");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }

      if (password.length < 6) {
        setMessage("Password must contain at least 6 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await updateProfile(credential.user, {
          displayName: name.trim(),
        });

        await setDoc(doc(db, "users", credential.user.uid), {
          uid: credential.user.uid,
          name: name.trim(),
          email: email.trim(),
          role: "doctor",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setSuccess(true);
        setMessage(
          "Your doctor account has been created successfully!"
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        setSuccess(true);
        setMessage("Welcome back! Authentication successful.");
      }
    } catch (error) {
      setSuccess(false);
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setMessage("Please enter your registered email address first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess(true);
      setMessage("Password reset link sent. Please check your email.");
    } catch (error) {
      setSuccess(false);
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      {/* LEFT BRAND PANEL */}
      <section className="brand-panel">
        <div className="brand-content">
          <div className="brand-logo">
            <div className="logo-symbol">
              <span>A</span>
              <span className="logo-leaf">✦</span>
            </div>
            <div>
              <h2>AushadhiSetu</h2>
              <p>Healthcare Management Platform</p>
            </div>
          </div>

          <div className="brand-main">
            <div className="brand-tag">
              <span className="pulse-dot"></span>
              YOUR HEALTHCARE, CONNECTED
            </div>

            <h1>
              Better Care.
              <br />
              <span>Smarter Healing.</span>
            </h1>

            <p className="brand-description">
              A unified digital space for healthcare professionals
              to manage patients, medical records and treatments
              with confidence.
            </p>

            <div className="brand-features">
              <div className="feature-item">
                <div className="feature-icon">✚</div>
                <div>
                  <strong>Patient Management</strong>
                  <p>Organized patient records and visit history.</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">⌁</div>
                <div>
                  <strong>Digital Prescriptions</strong>
                  <p>Manage treatments and prescriptions easily.</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">◈</div>
                <div>
                  <strong>Connected Healthcare</strong>
                  <p>Everything your clinic needs in one place.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <span>Inspired by Ayurveda. Built for modern care.</span>
            <span>© 2026 AushadhiSetu</span>
          </div>
        </div>

        <div className="decor-circle circle-one"></div>
        <div className="decor-circle circle-two"></div>
      </section>

      {/* RIGHT AUTHENTICATION PANEL */}
      <section className="auth-panel">
        <div className="mobile-brand">
          <div className="logo-symbol">
            <span>A</span>
            <span className="logo-leaf">✦</span>
          </div>
          <h2>AushadhiSetu</h2>
        </div>

        <div className="auth-container">
          <div className="auth-heading">
            <div className="welcome-icon">✚</div>

            <div className="auth-eyebrow">
              {mode === "login"
                ? "DOCTOR PORTAL"
                : "JOIN OUR PLATFORM"}
            </div>

            <h1>
              {mode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h1>

            <p>
              {mode === "login"
                ? "Sign in to access your healthcare workspace."
                : "Register to get started with AushadhiSetu."}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => resetForm("login")}
            >
              Sign In
            </button>

            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => resetForm("register")}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "register" && (
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <div className="input-wrapper">
                  <span className="input-icon">♙</span>
                  <input
                    id="name"
                    type="text"
                    placeholder="Dr. Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">✉</span>
                <input
                  id="email"
                  type="email"
                  placeholder="doctor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="password">Password</label>

                {mode === "login" && (
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={handleForgotPassword}
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <div className="input-wrapper">
                <span className="input-icon">▣</span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className="form-group">
                <label htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">▣</span>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    required
                  />
                </div>
              </div>
            )}

            {message && (
              <div className={`message ${success ? "success" : "error"}`}>
                <span>{success ? "✓" : "!"}</span>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="submit-button"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign In to Your Account"
                : "Create Doctor Account"}
              {!loading && <span>→</span>}
            </button>
          </form>

          <div className="auth-divider">
            <span>SECURE HEALTHCARE ACCESS</span>
          </div>

          <div className="security-note">
            <span className="security-icon">♧</span>
            <div>
              <strong>Your information stays protected</strong>
              <p>
                Secure authentication powered by Firebase.
              </p>
            </div>
          </div>

          <div className="auth-bottom">
            {mode === "login" ? (
              <>
                New to AushadhiSetu?{" "}
                <button onClick={() => resetForm("register")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already registered?{" "}
                <button onClick={() => resetForm("login")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        <div className="auth-copyright">
          Made for better healthcare experiences.
        </div>
      </section>
    </main>
  );
}
