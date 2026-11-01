import type { ReactNode } from "react";
import RouterConfig from "./Router/RouterConfig";
import { NavProvider } from "./Context/HomeNavigation.context";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "./config";

// Google sign-in is optional: the provider is only mounted when a client id is set.
function GoogleOptional({ children }: { children: ReactNode }) {
  if (!GOOGLE_CLIENT_ID) return <>{children}</>;
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>
  );
}

function App() {
  return (
    <GoogleOptional>
      <NavProvider>
        <RouterConfig />
      </NavProvider>
    </GoogleOptional>
  );
}

export default App;
