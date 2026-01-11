/**
 * Privacy Policy Page
 * Public page for App Store listing
 */

import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy - Tiered Pricing Pro" },
    { name: "description", content: "Privacy Policy for Tiered Pricing Pro Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> January 2025</p>

      <h2>Introduction</h2>
      <p>
        Tiered Pricing Pro ("we", "our", or "us") is committed to protecting your privacy.
        This Privacy Policy explains how we collect, use, and safeguard information when you
        use our Shopify application.
      </p>

      <h2>Information We Collect</h2>
      <p>When you install and use Tiered Pricing Pro, we collect:</p>
      <ul>
        <li><strong>Shop Information:</strong> Your Shopify store domain, name, and email address</li>
        <li><strong>Product Data:</strong> Product and collection information necessary to apply tiered pricing rules</li>
        <li><strong>Order Data:</strong> Order information to track discount usage and analytics</li>
        <li><strong>Customer Tags:</strong> Customer tag information for B2B/wholesale pricing features</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <p>We use the collected information to:</p>
      <ul>
        <li>Provide and maintain our tiered pricing service</li>
        <li>Apply quantity-based discounts at checkout</li>
        <li>Display pricing tables on your storefront</li>
        <li>Generate analytics and reports</li>
        <li>Improve our application</li>
      </ul>

      <h2>Data Storage and Security</h2>
      <p>
        Your data is stored securely using industry-standard encryption. We use PostgreSQL
        databases hosted on secure cloud infrastructure. We do not sell, trade, or transfer
        your data to third parties.
      </p>

      <h2>Data Retention</h2>
      <p>
        We retain your data for as long as you have our app installed. When you uninstall
        the app, we delete all your shop data within 48 hours in compliance with Shopify's
        requirements.
      </p>

      <h2>GDPR Compliance</h2>
      <p>
        We comply with GDPR requirements. You have the right to:
      </p>
      <ul>
        <li>Access your personal data</li>
        <li>Request correction of your data</li>
        <li>Request deletion of your data</li>
        <li>Object to data processing</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Our application uses essential cookies only for authentication and session management.
        We do not use tracking or advertising cookies.
      </p>

      <h2>Third-Party Services</h2>
      <p>
        We integrate with Shopify's APIs to provide our service. Please refer to
        <a href="https://www.shopify.com/legal/privacy" target="_blank" rel="noopener noreferrer"> Shopify's Privacy Policy</a> for
        information about their data practices.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any
        changes by posting the new Privacy Policy on this page.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy, please contact us at:
      </p>
      <p>
        <strong>Email:</strong> support@novamentstudios.com
      </p>

      <hr style={{ margin: "40px 0" }} />
      <p style={{ color: "#666", fontSize: "14px" }}>
        © 2025 Novament Studios. All rights reserved.
      </p>
    </div>
  );
}
