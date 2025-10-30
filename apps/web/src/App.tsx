import { RecoilRoot } from "recoil";
import RouterConfig from "./Router/RouterConfig";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools"; // Optional but helpful

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Optional: disable refetch on window focus
      retry: 1, // Optional: retry failed requests once
      staleTime: 5 * 60 * 1000, // Optional: 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        <RouterConfig />
      </RecoilRoot>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}

export default App;
