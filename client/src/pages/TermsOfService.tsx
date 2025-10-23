import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-8">Last Updated: January 2025</p>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Agreement to Terms</h2>
              <p className="text-gray-700 mb-4">
                By accessing or using FamMedicalCare ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Description of Service</h2>
              <p className="text-gray-700 mb-4">
                FamMedicalCare is a personal health management application that allows you to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Track medications, dosages, and schedules</li>
                <li>Manage medical appointments and visit summaries</li>
                <li>Store healthcare provider information</li>
                <li>Coordinate care with family members and caregivers</li>
                <li>Maintain personal health records</li>
              </ul>
              <p className="text-gray-700 mb-4">
                <strong>Important:</strong> FamMedicalCare is a personal health management tool and is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Responsibilities</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Account Security</h3>
              <p className="text-gray-700 mb-4">You are responsible for:</p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
                <li>Ensuring your account information is accurate and up-to-date</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">Acceptable Use</h3>
              <p className="text-gray-700 mb-4">You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree NOT to:</p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Use the Service in any way that violates applicable laws or regulations</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Upload or transmit viruses or malicious code</li>
                <li>Impersonate another person or entity</li>
                <li>Share your account with others without proper authorization</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">Data Accuracy</h3>
              <p className="text-gray-700 mb-4">
                You are responsible for the accuracy and completeness of all information you enter into the Service. We are not responsible for any consequences resulting from inaccurate or incomplete information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Medical Disclaimer</h2>
              <p className="text-gray-700 mb-4">
                <strong>FamMedicalCare is NOT a medical service provider and does NOT provide medical advice.</strong>
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>The Service is for informational and organizational purposes only</li>
                <li>We do not diagnose, treat, cure, or prevent any disease or medical condition</li>
                <li>Always consult with qualified healthcare professionals for medical advice</li>
                <li>In case of a medical emergency, call 911 or your local emergency number immediately</li>
                <li>Do not rely solely on the Service for medication management or health decisions</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Family Access and Sharing</h2>
              <p className="text-gray-700 mb-4">
                When you grant family members or caregivers access to your health information:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>You are solely responsible for determining who should have access</li>
                <li>You can control and modify access levels at any time</li>
                <li>You acknowledge that shared information may be viewed and managed by authorized users</li>
                <li>You are responsible for ensuring authorized users comply with these Terms</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
              <p className="text-gray-700 mb-4">
                The Service, including its original content, features, and functionality, is owned by FamMedicalCare and is protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-gray-700 mb-4">
                Your health information and data remain your property. By using the Service, you grant us a limited license to store, process, and display your data solely for the purpose of providing the Service to you.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service Availability</h2>
              <p className="text-gray-700 mb-4">
                We strive to provide reliable service, but we do not guarantee that:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>The Service will be available at all times without interruption</li>
                <li>The Service will be error-free or secure from unauthorized access</li>
                <li>Any defects will be corrected immediately</li>
              </ul>
              <p className="text-gray-700 mb-4">
                We reserve the right to modify, suspend, or discontinue the Service at any time with or without notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
              <p className="text-gray-700 mb-4">
                To the maximum extent permitted by law, FamMedicalCare shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Loss of data or information</li>
                <li>Loss of profits or business opportunities</li>
                <li>Service interruptions or delays</li>
                <li>Medical complications or adverse health outcomes</li>
              </ul>
              <p className="text-gray-700 mb-4">
                <strong>You acknowledge that the Service is a tool to help you organize health information and is not a substitute for professional medical care.</strong>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Indemnification</h2>
              <p className="text-gray-700 mb-4">
                You agree to indemnify and hold harmless FamMedicalCare and its affiliates from any claims, damages, losses, liabilities, and expenses arising from:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any rights of another party</li>
                <li>Any inaccurate or incomplete information you provide</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right to terminate or suspend your account and access to the Service at our sole discretion, without notice, for conduct that we believe:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
                <li>Violates these Terms</li>
                <li>Is harmful to other users or the Service</li>
                <li>Violates applicable laws or regulations</li>
              </ul>
              <p className="text-gray-700 mb-4">
                You may terminate your account at any time through the account settings. Upon termination, your right to use the Service will immediately cease.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to Terms</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governing Law</h2>
              <p className="text-gray-700 mb-4">
                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="text-gray-700">
                <strong>Email:</strong> support@fammedicalcare.com<br />
                <strong>Website:</strong> www.fammedicalcare.com
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acknowledgment</h2>
              <p className="text-gray-700 mb-4">
                By using FamMedicalCare, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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