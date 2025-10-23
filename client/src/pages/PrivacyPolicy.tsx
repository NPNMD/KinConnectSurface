import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light/20 to-secondary-light/20">
      {/* Navigation */}
      <nav className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Heart className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-gray-900">FamMedicalCare</span>
          </Link>
          <Link 
            to="/" 
            className="flex items-center space-x-2 text-gray-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last Updated: January 2025</p>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
              <p className="text-gray-700 mb-4">
                FamMedicalCare ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our personal medical journal application.
              </p>
              <p className="text-gray-700 mb-4">
                <strong>Important Note:</strong> FamMedicalCare is a personal health management tool designed for individual and family use. We are not a covered entity under HIPAA (Health Insurance Portability and Accountability Act) as we do not provide healthcare services, process health insurance claims, or act as a healthcare clearinghouse.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Personal Information</h3>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Name and email address (via Google Sign-In)</li>
                <li>Profile information you choose to provide</li>
                <li>Family member information you add to your account</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">Health Information</h3>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Medication names, dosages, and schedules</li>
                <li>Medical appointments and visit summaries</li>
                <li>Healthcare provider information</li>
                <li>Medical conditions and allergies</li>
                <li>Any other health-related information you choose to enter</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">Usage Information</h3>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Device information and browser type</li>
                <li>IP address and general location data</li>
                <li>App usage patterns and feature interactions</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
              <p className="text-gray-700 mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Provide and maintain the FamMedicalCare service</li>
                <li>Enable medication tracking and reminders</li>
                <li>Facilitate family member coordination and access</li>
                <li>Send you important service notifications</li>
                <li>Improve and optimize our application</li>
                <li>Ensure the security of your account and data</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Storage and Security</h2>
              <p className="text-gray-700 mb-4">
                Your data is stored securely using Google Firebase, a cloud-based platform with enterprise-grade security measures including:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Encryption in transit and at rest</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication</li>
                <li>Secure data centers with physical security</li>
              </ul>
              <p className="text-gray-700 mb-4">
                While we implement strong security measures, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security but are committed to protecting your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Sharing and Disclosure</h2>
              <p className="text-gray-700 mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li><strong>With Your Consent:</strong> When you explicitly authorize sharing with family members or caregivers through our family access features</li>
                <li><strong>Service Providers:</strong> With trusted third-party services that help us operate our application (e.g., Google Firebase, authentication services)</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect our rights and safety</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights and Choices</h2>
              <p className="text-gray-700 mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li><strong>Access:</strong> View all personal and health information stored in your account</li>
                <li><strong>Export:</strong> Download your data in a portable format</li>
                <li><strong>Correct:</strong> Update or correct any inaccurate information</li>
                <li><strong>Delete:</strong> Request deletion of your account and all associated data</li>
                <li><strong>Control Sharing:</strong> Manage family member access levels and permissions</li>
              </ul>
              <p className="text-gray-700 mb-4">
                To exercise these rights, please contact us at support@fammedicalcare.com or use the account settings within the application.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children's Privacy</h2>
              <p className="text-gray-700 mb-4">
                FamMedicalCare is intended for use by adults (18 years and older) managing their own or their family members' health information. We do not knowingly collect information from children under 13 without parental consent.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Privacy Policy</h2>
              <p className="text-gray-700 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. Significant changes will be communicated via email or in-app notification.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:
              </p>
              <p className="text-gray-700">
                <strong>Email:</strong> support@fammedicalcare.com<br />
                <strong>Website:</strong> www.fammedicalcare.com
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex justify-center space-x-6 mb-4">
            <Link to="/privacy" className="text-primary hover:text-primary-dark transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-primary hover:text-primary-dark transition-colors">
              Terms of Service
            </Link>
          </div>
          <p className="text-gray-600">&copy; 2024 FamMedicalCare. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}