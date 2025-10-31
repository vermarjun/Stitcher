import { RecoilRoot } from "recoil";
import RouterConfig from "./Router/RouterConfig";
import { NavProvider } from "./Context/HomeNavigation.context";

function App() {
  return (
    <NavProvider>
      <RecoilRoot>
        <RouterConfig />
      </RecoilRoot>
    </NavProvider>
  );
}

export default App;
