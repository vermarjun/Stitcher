import type { JSX } from "react";
import { Navigate } from "react-router-dom";

type PublicRouteProps = {
  children: JSX.Element;
};

const PublicRoute = ({ children }: PublicRouteProps) => {
  const token = localStorage.getItem("token");

  if (token) {
    // user is already logged in -> redirect to home
    return <Navigate to="/home" replace />;
  }

  return children;
};

export default PublicRoute;

