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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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
        // Basic client-side guard: passwords must match on sign-up.
        if (formData.password !== formData.confirmPassword) {
          toast.error("Passwords do not match.");
          setLoading(false);
          return;
        }

        // Signup request
        await api.post<any>("/users/signup", {
          username: formData.name,
          email: formData.email,
          password: formData.password,
        });

        // After successful registration, automatically log the user in
        const loginResponse = await api.post<AuthResponse>("/users/login", {
          email: formData.email,
          password: formData.password,
        });

        const data = loginResponse.data.user;

        // normalize createdAt to string
        const createdAt = data.createdAt
          ? new Date(data.createdAt).toISOString()
          : new Date().toISOString();

        const normalizedUser: IUser = {
          _id: data._id || "",
          username: data.username || "",
          email: data.email || "",
          profilePhoto:
            data.profilePhoto || "https://www.gravatar.com/avatar/?d=mp",
          profileBanner: data.profileBanner || "",
          createdAt,
          bio: data.bio || "",
          role: data.role,
          plan: data.plan || "free",
          credits: data.credits,
          aura: typeof data.aura === "number" ? data.aura : 0,
          stats: data.stats || {
            totalPosts: 0,
            totalLikes: 0,
            totalComments: 0,
            totalViews: 0,
            followersCount: 0,
            followingCount: 0,
            lastUpdated: new Date(),
          },
          followers: data.followers || [],
          following: data.following || [],
        };

        localStorage.setItem("token", loginResponse.data.token);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
        localStorage.setItem("lastAuthMethod", "password");

        if (socket.connected) socket.disconnect();
        socket.connect();
        toast.success("Registered Successfully!");
        navigate("/home");
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
      onModeChange={setMode}
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
    />
  );
};

export default AuthPage;
