// src/pages/PrivacyPolicy.tsx
import React from "react";

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center px-6 py-12">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Privacy Policy - Stitcher
        </h1>

        <p className="mb-4">
          At <span className="font-semibold">Stitcher</span>, your privacy is
          important to us. This Privacy Policy explains how we collect, use, and
          protect your information when you use our website or services.
        </p>

        <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
        <p className="mb-4">
          We may collect personal information such as your name, email address,
          and usage data when you interact with our website. We also collect
          non-identifiable data like browser type, device information, and
          cookies for analytics purposes.
        </p>

        <h2 className="text-xl font-semibold mb-2">2. How We Use Your Data</h2>
        <p className="mb-4">
          Stitcher uses the collected information to improve our services,
          personalize your experience, and communicate updates or promotional
          offers. We do not sell or rent your personal information to third
          parties.
        </p>

        <h2 className="text-xl font-semibold mb-2">3. Data Protection</h2>
        <p className="mb-4">
          We take reasonable measures to protect your personal data from
          unauthorized access, disclosure, or alteration. However, no system is
          100% secure, and we cannot guarantee absolute security.
        </p>

        <h2 className="text-xl font-semibold mb-2">4. Cookies</h2>
        <p className="mb-4">
          Our website uses cookies to enhance your browsing experience. You may
          choose to disable cookies in your browser settings, but some features
          may not work as intended.
        </p>

        <h2 className="text-xl font-semibold mb-2">5. Third-Party Services</h2>
        <p className="mb-4">
          We may use third-party services for analytics or payment processing.
          These third parties have their own privacy policies that govern their
          use of your information.
        </p>

        <h2 className="text-xl font-semibold mb-2">6. Changes to This Policy</h2>
        <p className="mb-4">
          Stitcher may update this Privacy Policy from time to time. We
          encourage you to review this page periodically to stay informed.
        </p>

        <p className="mt-8 text-center text-sm text-gray-400">
          Last updated: September 2025
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
