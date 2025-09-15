// src/pages/TermsAndConditions.tsx
import React from "react";

const TermsAndConditions: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center px-6 py-12">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Terms & Conditions
        </h1>

        <p className="mb-4">
          Welcome to Stitcher. By accessing or using our services, you agree
          to be bound by the following terms and conditions. Please read them
          carefully.
        </p>

        <h2 className="text-xl font-semibold mb-2">1. Use of Service</h2>
        <p className="mb-4">
          You agree to use this website only for lawful purposes. You must not
          use the website in any way that may damage, disable, or impair its
          functionality.
        </p>

        <h2 className="text-xl font-semibold mb-2">2. Intellectual Property</h2>
        <p className="mb-4">
          All content, logos, and graphics are owned by us. Unauthorized use is
          strictly prohibited.
        </p>

        <h2 className="text-xl font-semibold mb-2">3. Limitation of Liability</h2>
        <p className="mb-4">
          We are not responsible for any damages or losses arising from the use
          of our website or services.
        </p>

        <h2 className="text-xl font-semibold mb-2">4. Changes to Terms</h2>
        <p className="mb-4">
          We may update these Terms & Conditions at any time. Please check this
          page regularly for updates.
        </p>

        <p className="mt-8 text-center text-sm text-gray-400">
          Last updated: September 2025
        </p>
      </div>
    </div>
  );
};

export default TermsAndConditions;
