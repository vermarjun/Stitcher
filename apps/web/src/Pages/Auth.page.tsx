import React, { useState, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import { socket } from "@/socket";
import { toast } from "sonner";
import type { IUser } from "@/State/Types";
import { useGoogleLogin } from "@react-oauth/google";
import { SignInPage, type AuthFormData } from "@/Components/ui/sign-in";

interface AuthResponse {
  token: string;
  user: IUser;
}

export type SignupStep = "form" | "confirm" | "otp";

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [formData, setFormData] = useState<AuthFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setLoading] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [otpCode, setOtpCode] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Which method the user last authenticated with on this device ("google" |
  // "password"), read from localStorage. Drives the "Last used" hint badge.
  const [lastMethod, setLastMethod] = useState<string | null>(null);

  const navigate = useNavigate();
  const isLogin = mode === "login";

  // On mount: (1) if the API client logged us out (e.g. expired session) it
  // leaves a note in localStorage — surface it as a toast so the redirect isn't
  // silent. (2) Load the last-used auth method for the hint badge.
  useEffect(() => {
    const notice = localStorage.getItem("authNotice");
    if (notice === "session_expired") {
      toast.error("Your session expired — please sign in again.");
    }
    localStorage.removeItem("authNotice");
    setLastMethod(localStorage.getItem("lastAuthMethod"));
  }, []);

  // Reset OTP step when switching modes
  const handleModeChange = (newMode: "login" | "signup") => {
    setMode(newMode);
    setSignupStep("form");
    setOtpCode("");
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Helper: store auth response and navigate home
  const finalizeLogin = (token: string, rawUser: IUser): void => {
    const createdAt = rawUser.createdAt
      ? new Date(rawUser.createdAt).toISOString()
      : new Date().toISOString();

    const normalizedUser: IUser = {
      _id: rawUser._id || "",
      username: rawUser.username || "",
      email: rawUser.email || "",
      profilePhoto:
        rawUser.profilePhoto || "https://www.gravatar.com/avatar/?d=mp",
      profileBanner: rawUser.profileBanner || "",
      createdAt,
      bio: rawUser.bio || "",
      role: rawUser.role,
      plan: rawUser.plan || "free",
      credits: rawUser.credits,
      aura: typeof rawUser.aura === "number" ? rawUser.aura : 0,
      stats: rawUser.stats || {
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        totalViews: 0,
        followersCount: 0,
        followingCount: 0,
        lastUpdated: new Date(),
      },
      followers: rawUser.followers || [],
      following: rawUser.following || [],
    };

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    localStorage.setItem("lastAuthMethod", "password");
    if (socket.connected) socket.disconnect();
    socket.connect();
  };

  const handleSubmit = async (): Promise<void> => {
    setLoading(true);
    try {
      if (isLogin) {
        // Login request
        const response = await api.post<AuthResponse>("/users/login", {
          email: formData.email,
          password: formData.password,
        });
        const { token, user } = response.data;

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("lastAuthMethod", "password");
        // Reconnect socket so the new JWT lands in the handshake.auth.token
        if (socket.connected) socket.disconnect();
        socket.connect();
        toast.success("Welcome back!");
        navigate("/home", { replace: true });
      } else {
        // Signup: step "form" — validate passwords, then advance to "confirm"
        if (formData.password !== formData.confirmPassword) {
          toast.error("Passwords do not match.");
          setLoading(false);
          return;
        }
        setSignupStep("confirm");
      }
    } catch (error: any) {
      console.error(
        "Authentication error:",
        error.response?.data.message || error.message
      );

      // Handle specific error cases
      if (error.response?.status === 403 && error.response?.data?.banned) {
        setIsBanned(true);
      } else if (error.response?.status === 401) {
        toast.error(
          error.response?.data.message ||
            "Invalid credentials. Please try again."
        );
      } else if (error.response?.status === 409) {
        toast.error(
          error.response?.data.message ||
            "Invalid credentials. Please try again."
        );
      } else if (error.response?.status === 400) {
        toast.error("Please fill in all required fields.");
      } else {
        toast.error("An error occurred. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Step "confirm" → call /signup/start
  const handleConfirmEmail = async (): Promise<void> => {
    setLoading(true);
    try {
      await api.post("/users/signup/start", {
        username: formData.name,
        email: formData.email,
        password: formData.password,
      });
      setSignupStep("otp");
      setOtpCode("");
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        "Failed to send verification code. Please try again.";
      toast.error(msg);
      // On any error (e.g. email/username taken) go back to the form so the
      // user can correct their details.
      setSignupStep("form");
    } finally {
      setLoading(false);
    }
  };

  // Step "otp" → call /signup/verify
  const handleVerifyOtp = async (): Promise<void> => {
    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post<AuthResponse>("/users/signup/verify", {
        email: formData.email,
        code: otpCode,
      });
      const { token, user } = response.data;
      finalizeLogin(token, user);
      toast.success("Registered Successfully!");
      navigate("/home");
    } catch (error: any) {
      const status = error.response?.status;
      const msg = error.response?.data?.message || "Verification failed.";
      if (status === 429) {
        // Too many attempts — send back to the form
        toast.error(msg);
        setSignupStep("form");
        setOtpCode("");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Step "otp" → resend code
  const handleResendOtp = async (): Promise<void> => {
    setIsResending(true);
    try {
      await api.post("/users/signup/resend", { email: formData.email });
      toast.success("A new code has been sent to your email.");
      setOtpCode("");
    } catch (error: any) {
      const msg =
        error.response?.data?.message || "Failed to resend code. Try again.";
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  };

  const responseGoogle = async (authResult: any) => {
    try {
      setLoading(true);
      if (authResult["code"]) {
        const response = await api.get<AuthResponse>(
          `users/google?code=${authResult.code}`
        );
        const { token, user } = response.data;

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("lastAuthMethod", "google");
        if (socket.connected) socket.disconnect();
        socket.connect();
        toast.success(
          `Welcome ${user.username}! Let's get some Stitching Done.`
        );
        navigate("/home", { replace: true });
      } else {
        console.log(authResult);
        throw new Error(authResult);
      }
    } catch (error: any) {
      console.error(
        "Authentication error:",
        error.response?.data.message || error.message
      );

      if (error.response?.status === 403 && error.response?.data?.banned) {
        setIsBanned(true);
      } else if (error.response?.status === 401) {
        toast.error(
          error.response?.data.message ||
            "Invalid credentials. Please try again."
        );
      } else if (error.response?.status === 409) {
        toast.error(
          error.response?.data.message ||
            "Invalid credentials. Please try again."
        );
      } else if (error.response?.status === 400) {
        toast.error("Please fill in all required fields.");
      } else {
        toast.error("An error occurred. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: responseGoogle,
    onError: responseGoogle,
    flow: "auth-code",
  });

  return (
    <SignInPage
      mode={mode}
      onModeChange={handleModeChange}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      onGoogleSignIn={() => googleLogin()}
      onResetPassword={() =>
        toast.info("Password reset is coming soon — try Google sign-in.")
      }
      isLoading={isLoading}
      isBanned={isBanned}
      lastMethod={lastMethod}
      signupStep={signupStep}
      onConfirmEmail={handleConfirmEmail}
      onBackToForm={() => setSignupStep("form")}
      otpCode={otpCode}
      onOtpChange={setOtpCode}
      onVerifyOtp={handleVerifyOtp}
      onResendOtp={handleResendOtp}
      isResending={isResending}
    />
  );
};

export default AuthPage;
