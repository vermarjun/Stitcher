import React, { Suspense, lazy } from "react";
import LazyWrapper from "./LazyWrapper.landing.page";
import GlassyNavbar from "./Navbar.landing.page";
import PaymentPage from "./Pricing.landing.page";

// Lazy load all components except Navbar (which should load immediately)
const Hero = lazy(() => import("./Hero.landing.page"));
const Features = lazy(() => import("./Features.landing.page"));
const Examples = lazy(() => import("./Examples.landing.page"));
const Testimonials = lazy(() => import("./Testimonials.landing.page"));
const Footer = lazy(() => import("./Footer.landing.page"));
const EndPageCTA = lazy(() => import("./EndpageCTA.landing.page"));

// Loading fallback component
const LoadingFallback: React.FC<{ height?: string }> = ({
  height = "h-64",
}) => (
  <div className={`${height} bg-black flex items-center justify-center`}>
    <div className="animate-pulse flex space-x-4">
      <div className="rounded-full bg-gray-800 h-4 w-4"></div>
      <div className="rounded-full bg-gray-800 h-4 w-4"></div>
      <div className="rounded-full bg-gray-800 h-4 w-4"></div>
    </div>
  </div>
);

const LandingPage: React.FC = () => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollRef} className="h-screen w-full bg-black overflow-y-scroll snap-y snap-proximity scroll-smooth no-scrollbar overscroll-none">
      <div className="fixed top-0 left-0 z-50 w-full" id="home">
        <GlassyNavbar />
      </div>

      <section className="w-full h-screen">
        <Hero />
      </section>

      <LazyWrapper fallback={<LoadingFallback />}>
        <Suspense fallback={<LoadingFallback />}>
           <section id="features" className="snap-always w-full min-h-screen flex flex-col justify-center">
             <Features />
           </section>
        </Suspense>
      </LazyWrapper>

      <LazyWrapper fallback={<LoadingFallback />}>
        <Suspense fallback={<LoadingFallback />}>
           <section id="examples" className="w-full min-h-screen flex flex-col justify-center">
             <Examples />
           </section>
        </Suspense>
      </LazyWrapper>

      <LazyWrapper fallback={<LoadingFallback />}>
        <Suspense fallback={<LoadingFallback />}>
           <section className="w-full flex flex-col justify-center">
             <Testimonials />
           </section>
        </Suspense>
      </LazyWrapper>

      <LazyWrapper fallback={<LoadingFallback />}>
        <Suspense fallback={<LoadingFallback />}>
           <section className="w-full min-h-screen flex flex-col justify-center">
             <PaymentPage/>
           </section>
        </Suspense>
      </LazyWrapper>

      <LazyWrapper fallback={<LoadingFallback />}>
        <Suspense fallback={<LoadingFallback />}>
           <section id="endpagecta" className="w-full flex flex-col justify-center">
            <EndPageCTA />
            <Footer />
           </section>
        </Suspense>
      </LazyWrapper>
    </div>
  );
};

export default LandingPage;
