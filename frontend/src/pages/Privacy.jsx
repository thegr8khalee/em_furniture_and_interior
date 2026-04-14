import React from 'react';
import { motion } from 'framer-motion';
import { luxuryEase, elegantEase } from '../lib/animations';
import { PageWrapper, FadeIn } from '../components/animations';
// import Hero1 from '../images/Hero1.png';
// import ME from '../images/ME.png';
// import CEO from '../images/CEO.png';

const Privacy = () => {
  return (
    <PageWrapper>
    <div className="min-h-screen bg-white pt-16 pb-12">
      <div className="relative h-48 sm:h-64 overflow-hidden">
        <motion.img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"} alt="" className="object-cover h-full w-full" initial={{ scale: 1.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease: luxuryEase }} />
        <div className="absolute inset-0 bg-primary/80 flex flex-col items-center justify-center">
          <motion.h1 className="w-full mb-2 text-3xl sm:text-4xl font-heading font-bold text-center text-white" initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, delay: 0.5, ease: elegantEase }}>
            Privacy Policy
          </motion.h1>
          <motion.p className="text-white/70 text-sm tracking-widest uppercase text-center mt-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8, ease: elegantEase }}>
            Effective Date: July 8, 2025
          </motion.p>
        </div>
      </div>
      <FadeIn>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6 text-neutral/70 leading-relaxed font-body">
          <p className="mb-6 text-neutral/70">
            This Privacy Policy describes how EM Furniture and Interior
            collects, uses, and shares information when you use our website,
            emfurnitureandinterior.com .
          </p>

          <h2 className="text-xl font-heading font-semibold text-neutral mb-4 mt-8">
            1. Information We Collect
          </h2>

          <h3 className="text-lg font-heading font-medium text-secondary mb-2">
            a. Information You Provide Directly (for Authenticated Users)
          </h3>
          <p className="mb-4 text-neutral/70">
            When you create an account, log in, update your profile, or use
            features like the cart and wishlist while logged in, you provide us
            with personal information. This may include:
          </p>
          <ul className="list-disc list-inside ml-4 mb-4 text-neutral/70">
            <li>
              <strong>Account Information:</strong> Your username, email
              address, and password (hashed).
            </li>
            <li>
              <strong>Profile Information:</strong> Your phone number (if
              provided).
            </li>
            <li>
              <strong>Transaction Data:</strong> Details about items in your
              cart and wishlist, including product/collection IDs and
              quantities.
            </li>
            <li>
              <strong>Communications:</strong> Any information you provide when
              you contact us (e.g., customer support inquiries).
            </li>
          </ul>

          <h3 className="text-lg font-heading font-medium text-secondary mb-2">
            b. Information Stored Locally (for Unauthenticated Users)
          </h3>
          <p className="mb-4 text-neutral/70">
            If you are not logged in or do not have an active guest session, we
            use your browser's local storage to save certain data directly on
            your device. This data is **not sent to or stored on our servers**.
            This may include:
          </p>
          <ul className="list-disc list-inside ml-4 mb-4 text-neutral/70">
            <li>
              <strong>Local Cart Data:</strong> Product/collection IDs, item
              types, and quantities of items you've added to your shopping cart.
            </li>
            <li>
              <strong>Local Wishlist Data:</strong> Product/collection IDs and
              item types of items you've added to your wishlist.
            </li>
          </ul>
          <p className="mb-6 text-neutral/70">
            <strong>Important Note:</strong> This local storage data is only
            accessible by your browser on your device. If you clear your
            browser's local storage, switch devices, or use a different browser,
            this data will be lost and not synchronized with our servers unless
            you log in.
          </p>

          <h3 className="text-lg font-heading font-medium text-secondary mb-2">
            c. Automatically Collected Information (Standard Web Practices)
          </h3>
          <p className="mb-6 text-neutral/70">
            Like most websites, we may automatically collect certain information
            about your device and usage patterns when you access our Service.
            This information is typically collected through standard web server
            logs and does not directly identify you. It may include:
          </p>
          <ul className="list-disc list-inside ml-4 mb-6 text-neutral/70">
            <li>
              <strong>Device Information:</strong> IP address, browser type,
              operating system, device type.
            </li>
            <li>
              <strong>Usage Data:</strong> Pages viewed, time spent on pages,
              referral source, and interactions with the Service.
            </li>
          </ul>
          <p className="mb-6 text-neutral/70">
            <strong>
              We do not use a server-side "guest system" or assign persistent
              anonymous identifiers to track unauthenticated users across
              sessions on our backend.
            </strong>
          </p>

          <h2 className="text-2xl font-heading font-semibold  mb-4">
            2. How We Use Your Information
          </h2>
          <p className="mb-6 text-neutral/70">
            We use the information we collect for the following purposes:
          </p>
          <ul className="list-disc list-inside ml-4 mb-6 text-neutral/70">
            <li>
              <strong>To Provide and Maintain the Service:</strong> To operate
              our website, manage your account, process your cart and wishlist
              (for authenticated users), and deliver the features you use.
            </li>
            <li>
              <strong>To Improve Our Service:</strong> To understand how users
              interact with our website, identify areas for improvement, and
              enhance user experience.
            </li>
            <li>
              <strong>To Communicate With You:</strong> To respond to your
              inquiries, provide customer support, and send you important
              updates related to your account or the Service.
            </li>
            <li>
              <strong>For Security and Fraud Prevention:</strong> To protect our
              Service and users from fraudulent activities and unauthorized
              access.
            </li>
            <li>
              <strong>To Comply with Legal Obligations:</strong> To meet legal
              and regulatory requirements.
            </li>
          </ul>

          <h2 className="text-xl font-heading font-semibold text-neutral mb-4 mt-8">
            3. Data Sharing and Disclosure
          </h2>
          <p className="mb-6 text-neutral/70">
            We do not sell or rent your personal information to third parties.
            We may share your information in the following limited
            circumstances:
          </p>
          <ul className="list-disc list-inside ml-4 mb-6 text-neutral/70">
            <li>
              <strong>With Service Providers:</strong> We may share your
              information with third-party vendors and service providers who
              perform services on our behalf, such as hosting, analytics, and
              potentially payment processing (if checkout is implemented). These
              providers are obligated to protect your information and use it
              only for the purposes for which it was disclosed.
            </li>
            <li>
              <strong>For Legal Reasons:</strong> We may disclose your
              information if required to do so by law or in response to valid
              requests by public authorities (e.g., a court order or government
              agency).
            </li>
            <li>
              <strong>Business Transfers:</strong> In connection with any
              merger, sale of company assets, financing, or acquisition of all
              or a portion of our business by another company.
            </li>
          </ul>

          <h2 className="text-xl font-heading font-semibold text-neutral mb-4 mt-8">
            4. Data Storage and Security
          </h2>
          <ul className="list-disc list-inside ml-4 mb-6 text-neutral/70">
            <li>
              <strong>Authenticated User Data:</strong> Your personal data
              (username, email, phone number, server-side cart/wishlist) is
              stored on our secure backend servers. We implement reasonable
              technical and organizational measures to protect your data from
              unauthorized access, alteration, disclosure, or destruction.
            </li>
            <li>
              <strong>Unauthenticated User Data:</strong> Data stored in your
              browser's `localStorage` is not transmitted to our servers. Its
              security depends on the security of your device and browser.
            </li>
          </ul>

          <h2 className="text-xl font-heading font-semibold text-neutral mb-4 mt-8">
            5. Your Privacy Rights
          </h2>

          <h3 className="text-lg font-heading font-medium text-secondary mb-2">
            a. For Authenticated Users:
          </h3>
          <p className="mb-4 text-neutral/70">You have the right to:</p>
          <ul className="list-disc list-inside ml-4 mb-6 text-neutral/70">
            <li>
              <strong>Access and Update:</strong> Access and update your profile
              information directly through your account settings.
            </li>
            <li>
              <strong>Deletion:</strong> Request the deletion of your account
              and associated personal data. Please contact us to initiate this
              process.
            </li>
            <li>
              <strong>Data Portability:</strong> Request a copy of your data in
              a structured, commonly used, machine-readable format.
            </li>
          </ul>

          <h3 className="text-lg font-heading font-medium text-secondary mb-2">
            b. For Unauthenticated Users:
          </h3>
          <ul className="list-disc list-inside ml-4 mb-6 text-neutral/70">
            <li>
              <strong>Local Storage Management:</strong> You can manage or clear
              the data stored in your browser's local storage through your
              browser settings. Please refer to your browser's help
              documentation for instructions. Clearing local storage will remove
              your locally stored cart and wishlist data.
            </li>
          </ul>

          <h3 className="text-lg font-heading font-medium text-secondary mb-2">
            c. Cookies:
          </h3>
          <p className="mb-6 text-neutral/70">
            We use cookies for session management (e.g., to keep you logged in).
            You can configure your browser to accept or reject cookies, or to
            notify you when a cookie is being sent. However, some features of
            our Service may not function properly without cookies.
          </p>

          <h2 className="text-xl font-heading font-semibold text-neutral mb-4 mt-8">
            6. Changes to This Privacy Policy
          </h2>
          <p className="mb-6 text-neutral/70">
            We may update this Privacy Policy from time to time to reflect
            changes in our practices or for other operational, legal, or
            regulatory reasons. We will notify you of any significant changes by
            posting the new Privacy Policy on this page and updating the
            "Effective Date" at the top.
          </p>

          <h2 className="text-2xl font-semibold font-heading mb-4">7. Contact Us</h2>
          <p className="mb-6 text-neutral/70">
            If you have any questions or concerns about this Privacy Policy or
            our data practices, please contact us at:
          </p>
          <ul className="list-disc list-inside ml-4 mb-6 text-neutral/70">
            <li>
              Email:{' '}
              <a href="mailto:emfurnitureandinterior@gmail.com" className=" hover:underline">
                emfurnitureandinterior@gmail.com
              </a>
            </li>
            <li>
              Phone:{' '}
              <a href="tel:+2349037691860" className=" hover:underline">
                +2349037691860
              </a>
            </li>
            <li>Address: C16 Bamaiyi Road, Kaduna, Nigeria</li>
          </ul>
        </div>
      </div>
      </FadeIn>
    </div>
    </PageWrapper>
  );
};

export default Privacy;
