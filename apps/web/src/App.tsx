import { RecoilRoot } from "recoil";
import RouterConfig from "./Router/RouterConfig";
import { NavProvider } from "./Context/HomeNavigation.context";
import { GoogleOAuthProvider } from "@react-oauth/google";
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function App() {

  console.log("clientId: ",clientId)
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <NavProvider>
        <RecoilRoot>
          <RouterConfig />
        </RecoilRoot>
      </NavProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
