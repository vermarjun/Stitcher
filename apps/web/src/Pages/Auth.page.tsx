import React, {
  useState,
  useRef,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import { Eye, EyeOff, Mail, Lock, User2Icon, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import { toast } from "sonner";
import type { IUser } from "@/State/Types";
import { FlickeringGrid } from "@/Components/ui/flickering-grid";
import { useGoogleLogin } from "@react-oauth/google";

// Define types
interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface AuthResponse {
  token: string;
  user: IUser;
}

interface DustParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  delay: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [dustParticles, setDustParticles] = useState<DustParticle[]>([]);
  const [isLoading, setLoading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  const createDustParticles = (): void => {
    if (!formRef.current) return;

    const rect = formRef.current.getBoundingClientRect();
    const particles: DustParticle[] = [];

    for (let i = 0; i < 20; i++) {
      // Determine which edge to emit from
      const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      let startX: number, startY: number;

      switch (edge) {
        case 0: // Top edge
          startX = Math.random() * rect.width;
          startY = 0;
          break;
        case 1: // Right edge
          startX = rect.width;
          startY = Math.random() * rect.height;
          break;
        case 2: // Bottom edge
          startX = Math.random() * rect.width;
          startY = rect.height;
          break;
        case 3: // Left edge
          startX = 0;
          startY = Math.random() * rect.height;
          break;
        default:
          startX = 0;
          startY = 0;
      }

      // Add some randomness to initial position
      startX += (Math.random() - 0.5) * 20;
      startY += (Math.random() - 0.5) * 20;

      particles.push({
        id: i,
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: Math.random() * 4 + 2,
        opacity: Math.random() * 0.6 + 0.4,
        delay: Math.random() * 200,
        color: Math.random() > 0.7 ? "#3b82f6" : "#ffffff",
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    setDustParticles(particles);

    setTimeout(() => setDustParticles([]), 1500);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    e?: MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    e?.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        console.log("Form submitted: login", formData);

        // Login request
        const response = await api.post<AuthResponse>("/users/login", {
          email: formData.email,
          password: formData.password,
        });
        const { token, user } = response.data;

         console.log("login response data: ", user);

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        toast.success("Welcome back!");
        navigate("/home", { replace: true });
      } else {
        // Signup request
        await api.post("/users/signup", {
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

        toast.success("Registered Successfully!");
        navigate("/home");
      }
    } catch (error: any) {
      console.error(
        "Authentication error:",
        error.response?.data.message || error.message
      );

      // Handle specific error cases
      if (error.response?.status === 401) {
        toast.error(
          error.response?.data.message ||
            "Invalid credentials. Please try again."
        );
      } else if (error.response?.status === 409) {
        console.log(error);
        toast.error(
          error.response.data.message ||
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

  const toggleAuthMode = (): void => {
    if (isAnimating) return;

    setIsAnimating(true);
    createDustParticles();

    setTimeout(() => {
      setIsLogin(!isLogin);
      setTimeout(() => setIsAnimating(false), 400);
    }, 200);
  };

  const GoogleIcon: React.FC = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );

  const responseGoogle = async (authResult:any) => {
    try {
      setLoading(true)
			if (authResult["code"]) {
				const response = await api.get<AuthResponse>(`users/google?code=${authResult.code}`);
        const { token, user } = response.data;

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        toast.success(`Welcome ${user.username}! Let's get some Stitching Done.`);
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

      // Handle specific error cases
      if (error.response?.status === 401) {
        toast.error(
          error.response?.data.message ||
            "Invalid credentials. Please try again."
        );
      } else if (error.response?.status === 409) {
        console.log(error);
        toast.error(
          error.response.data.message ||
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
  })

  return (
    <div className="bg-black w-screen h-screen flex justify-center items-center z-10 relative overflow-hidden">
      {/* Background subtle pattern */}
      <div className="w-full h-full absolute inset-0 z-0">
        <FlickeringGrid
          className="relative inset-0 z-0 [mask-image:radial-gradient(650px_circle_at_center,white,transparent)]"
          squareSize={4}
          gridGap={6}
          color="#60A5FA"
          maxOpacity={0.5}
          flickerChance={0.1}
        />
      </div>
      {/* Main auth card */}
      <div className="relative w-full max-w-md z-10">
        <div
          className={`relative transition-all duration-500 ease-out ${
            isAnimating ? "scale-105" : "scale-100"
          }`}
        >
          {/* Card */}
          <div className="relative bg-gray-950 border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/50 overflow-hidden">
            {/* Header */}
            <div className="text-center mb-4">
              <h1 className="text-2xl font-semibold text-white mb-1 tracking-tight">
                {isLogin ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-gray-400 text-xs font-light">
                {isLogin
                  ? "Sign in to continue to your account"
                  : "Get started with your free account"}
              </p>
            </div>

            {/* Auth mode toggle */}
            <div className="relative mb-4">
              <div className="bg-gray-900 rounded-xl p-1 flex relative border border-gray-800">
                <div
                  className={`absolute top-1 bottom-1 w-1/2 bg-white rounded-lg transition-all duration-300 ease-out ${
                    isLogin ? "translate-x-0" : "translate-x-full"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => !isLogin && toggleAuthMode()}
                  className={`relative z-10 flex-1 py-2 px-4 text-xs font-medium rounded-lg transition-all duration-300 ${
                    isLogin ? "text-black" : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => isLogin && toggleAuthMode()}
                  className={`relative z-10 flex-1 py-2 px-4 text-xs font-medium rounded-lg transition-all duration-300 ${
                    !isLogin
                      ? "text-black"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {/* Google Auth Button */}
            <button
              type="button"
              className="w-full text-sm bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white py-2 px-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:border-gray-700 group font-medium"
              onClick={()=>googleLogin()}
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            {/* Improved divider */}
            <div className="relative mt-6 mb-3 flex items-center">
              <div className="flex-grow border-t border-gray-800" />
              <div className="relative flex-shrink-0 px-4">
                <div className="bg-black px-3 py-1 rounded-full border border-gray-800">
                  <span className="text-xs text-gray-500 font-light tracking-wide">
                    OR
                  </span>
                </div>
              </div>
              <div className="flex-grow border-t border-gray-800" />
            </div>

            {/* Form Container */}
            <div className="relative">
              {/* Dust particles - positioned relative to form */}
              {dustParticles.map((particle) => (
                <div
                  key={particle.id}
                  className="absolute w-1 h-1 rounded-full pointer-events-none z-50"
                  style={{
                    left: `${particle.x}px`,
                    top: `${particle.y}px`,
                    opacity: particle.opacity,
                    backgroundColor: particle.color,
                    transform: `scale(${particle.size}) rotate(${particle.rotation}deg)`,
                    animation: `dustFloat 1.5s ease-out forwards`,
                    animationDelay: `${particle.delay}ms`,
                  }}
                />
              ))}

              <div ref={formRef} className="space-y-3">
                {/* Name field */}
                <div
                  className={`transition-all duration-400 ease-in-out overflow-hidden ${
                    isLogin
                      ? "max-h-0 opacity-0 -translate-y-2"
                      : "max-h-20 opacity-100 translate-y-0"
                  }`}
                >
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User2Icon className="h-4 w-4 text-gray-500" />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full pl-11 pr-4 py-2 bg-gray-900 border text-xs placeholder:text-sm border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300 font-light"
                      placeholder="Full name"
                    />
                  </div>
                </div>

                {/* Email field */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-2 text-sm placeholder:text-sm bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300 font-light"
                    placeholder="Email address"
                    required
                  />
                </div>

                {/* Password field */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-12 py-2 text-sm placeholder:text-sm bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300 font-light"
                    placeholder="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors duration-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Confirm Password field */}
                <div
                  className={`transition-all duration-400 ease-in-out overflow-hidden ${
                    isLogin
                      ? "max-h-0 opacity-0 -translate-y-2"
                      : "max-h-20 opacity-100 translate-y-0"
                  }`}
                >
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-500" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full pl-11 pr-12 py-2 text-sm placeholder:text-sm bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-300 font-light"
                      placeholder="Confirm password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors duration-300"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Login options */}
                <div
                  className={`transition-all duration-400 ease-in-out overflow-hidden ${
                    !isLogin ? "max-h-0 opacity-0" : "max-h-20 opacity-100"
                  }`}
                >
                  <div className="flex items-center text-xs justify-between">
                    <label className="flex items-center text-gray-400 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="mr-2 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500 focus:ring-1 transition-all duration-200"
                      />
                      <span className="group-hover:text-gray-300 transition-colors duration-200 font-light">
                        Remember me
                      </span>
                    </label>
                    <button
                      type="button"
                      className="text-blue-400 text-xs hover:text-blue-300 transition-colors duration-300 font-light"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading} // Disable button when loading
                    className="w-full bg-white hover:bg-gray-100 text-black font-medium py-2 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white/20 group disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isLoading ? (
                        // Loader spinner
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                        </div>
                      ) : (
                        // Normal button content
                        <>
                          <span>{isLogin ? "Sign in" : "Create account"}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 text-center text-xs text-gray-500">
              <span>
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </span>
              <button
                type="button"
                onClick={toggleAuthMode}
                className="text-white hover:text-gray-300 text-sm transition-colors duration-300 font-medium"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dustFloat {
          0% {
            opacity: 0.8;
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translate(${Math.random() > 0.5 ? "" : "-"}${
        20 + Math.random() * 30
      }px, ${Math.random() > 0.5 ? "" : "-"}${
        20 + Math.random() * 30
      }px) scale(0.1) rotate(${Math.random() * 360}deg);
          }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
