import React from 'react';
import { motion } from 'framer-motion';
import { luxuryEase, elegantEase } from '../lib/animations';
import { PageWrapper, FadeIn } from '../components/animations';
// import Hero1 from '../images/Hero1.png';
// import ME from '../images/ME.png';
// import CEO from '../images/CEO.png';

const Terms = () => {
  return (
    <PageWrapper>
    <div className="min-h-screen bg-base-200 pt-16">
      <div className="relative h-48 sm:h-56 overflow-hidden">
        <motion.img src={"https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"} alt="" className="object-cover h-full w-full" initial={{ scale: 1.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease: luxuryEase }} />
        <div className="absolute inset-0 bg-primary/80 flex flex-col items-center justify-center">
          <motion.h1 className="font-heading text-3xl sm:text-4xl font-semibold text-white text-center" initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, delay: 0.5, ease: elegantEase }}>
            Terms &amp; Conditions
          </motion.h1>
          <div className="divider-gold mt-3" />
          <motion.p className="text-white/70 text-sm mt-2 tracking-wider" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8, ease: elegantEase }}>
            Effective Date: July 8, 2025
          </motion.p>
        </div>
      </div>
      <FadeIn>
      <div className="w-full flex justify-center px-4 py-10">
        <div className="w-full max-w-4xl space-y-6 text-neutral/70 text-sm leading-relaxed">
          {/* ORDER & PAYMENT */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              Order & Payment
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>50â€“80% deposit to confirm order</li>
              <li>For foreign products, only full deposits are accepted.</li>
              <li>Balance must be paid before delivery</li>
              <li>Production starts after payment & design confirmation</li>
            </ul>
            <h4 className="font-heading font-semibold text-neutral mt-4 mb-2">PAYMENT DETAILS</h4>
            <ul className="list-disc list-inside ml-4 text-sm">
              <li>Bank Name: Taj Bank</li>
              <li>Account Name: Amina Musa Abdullahi</li>
              <li>Account Number: 0004052820</li>
            </ul>
            <p className="mt-4 text-sm">
              By sending a deposit, it means you have agreed to our terms and
              conditions.
            </p>
          </div>

          {/* CUSTOM ORDERS */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              Custom Furniture
            </h3>
            <p className="mb-2 text-sm">
              All items are custom-built based on the clientâ€™s preferences and
              measurements.
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>
                Once production begins, designs, sizes, materials, or colors
                cannot be changed
              </li>
              <li>
                Clients must confirm all specifications before or immediately
                after deposit is made
              </li>
            </ul>
          </div>

          {/* PRODUCTION TIMELINE */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              Production Time
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Production timeline: 3â€“6 weeks depending on the product</li>
              <li>Shipping takes 5â€“6 weeks</li>
              <li>Urgent jobs may attract extra charges</li>
            </ul>
          </div>

          {/* REFUND POLICY */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              Refund Policy
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Refunds allowed only:</li>
              <ul className="list-[circle] list-inside ml-8">
                <li>Before production begins</li>
                <li>For proven manufacturing defects</li>
              </ul>
              <li>After production, refund only after resale</li>
            </ul>
          </div>

          {/* WARRANTY */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">Warranty</h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>3 months on manufacturing defects only</li>
              <li>Does NOT cover:</li>
              <ul className="list-[circle] list-inside ml-8">
                <li>Misuse</li>
                <li>Water damage</li>
                <li>Poor handling</li>
              </ul>
              <li>Clients must inspect items on delivery</li>
            </ul>
          </div>

          {/* DELIVERY POLICY */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              Delivery Policy
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Delivery through suggested 3rd party drivers</li>
              <li>Shipping fee is to be discussed on order</li>
              <li>Optional insured delivery available â€” extra charges apply</li>
              <li>
                We are not responsible for any damage that occurs during
                delivery
              </li>
              <li>Client may also arrange pickup</li>
            </ul>
          </div>

          {/* INTERNATIONAL DELIVERY */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              Outside Nigeria (International Delivery)
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>We deliver to neighbouring countries</li>
              <li>Client must provide a trusted shipping agent</li>
              <li>We package and release responsibly</li>
            </ul>
          </div>

          {/* AFTER PRODUCTION */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              After Production
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Delivery expected within 7 days of completion</li>
              <li>Delays attract storage charges</li>
            </ul>
          </div>

          {/* INSTALLATIONS */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              Installations
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Available for:</li>
              <ul className="list-[circle] list-inside ml-8">
                <li>High beds</li>
                <li>Wall panels</li>
                <li>Kitchens</li>
              </ul>
              <li>Extra charges apply</li>
              <li>Depends on location</li>
            </ul>
          </div>

          {/* SITE MEASUREMENTS */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">
              Measurements (Site Measurements)
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>On-site visits are not free</li>
              <li>Charges depend on your location</li>
              <li>Client is responsible for providing correct measurements</li>
            </ul>
          </div>

          {/* COMPLAINTS */}
          <div>
            <h3 className="text-lg font-heading font-semibold text-neutral mb-2">Complaints</h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Must be reported within 24 hours of delivery</li>
              <li>Send complaints via WhatsApp or DM</li>
              <li>Include clear pictures if needed</li>
              <li>Complaints made after 24 hours will not be attended to.</li>
            </ul>
          </div>
        </div>
      </div>
      </FadeIn>
    </div>
    </PageWrapper>
  );
};

export default Terms;
