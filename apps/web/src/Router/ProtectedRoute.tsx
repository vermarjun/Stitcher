import type { JSX } from "react";
import { Navigate } from "react-router-dom";

type ProtectedRouteProps = {
  children: JSX.Element;
};

const AuthRouter = ({ children }: ProtectedRouteProps) => {
  const token = localStorage.getItem("token"); // or whatever key you used

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default AuthRouter;
