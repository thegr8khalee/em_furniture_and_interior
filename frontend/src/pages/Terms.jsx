import React from 'react';
import Hero1 from '../images/Hero1.png';
import ME from '../images/ME.png';
import CEO from '../images/CEO.png';

const Terms = () => {
  return (
    <div className="pt-16">
      <div className="relative">
        <img src={Hero1} alt="" className="object-cover h-40 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
          <h1 className="absolute bottom-10 left-1/2 -translate-x-1/2 mt-20 w-full mb-2 text-3xl font-bold text-center text-base-100 font-[poppins]">
            Terms and Conditions for EM Furnture & Interior
          </h1>
          <p className="absolute bottom-7 left-1/2 -translate-x-1/2 text-base-100 font-[montserrat] w-full text-center">
            Effective Date: July 8, 2025
          </p>
        </div>
      </div>
      <div className="w-full justify-center flex p-4">
        <div className="w-full space-y-2 flex flex-col max-w-7xl font-[montserrat]">
          {/* ORDER & PAYMENT */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-xl font-bold font-[poppins] mb-2">
              Order & Payment
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>50–80% deposit to confirm order</li>
              <li>For foreign products, only full deposits are accepted.</li>
              <li>Balance must be paid before delivery</li>
              <li>Production starts after payment & design confirmation</li>
            </ul>
            <h4 className="font-semibold font-[poppins] mt-4 mb-2">PAYMENT DETAILS</h4>
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
            <h3 className="text-xl font-bold font-[poppins] mb-2">
              Custom Furniture
            </h3>
            <p className="mb-2 text-sm">
              All items are custom-built based on the client’s preferences and
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
            <h3 className="text-xl font-bold font-[poppins] mb-2">
              Production Time
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Production timeline: 3–6 weeks depending on the product</li>
              <li>Shipping takes 5–6 weeks</li>
              <li>Urgent jobs may attract extra charges</li>
            </ul>
          </div>

          {/* REFUND POLICY */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-xl font-bold font-[poppins] mb-2">
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
            <h3 className="text-xl font-bold font-[poppins] mb-2">Warranty</h3>
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
            <h3 className="text-xl font-bold font-[poppins] mb-2">
              Delivery Policy
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Delivery through suggested 3rd party drivers</li>
              <li>Shipping fee is to be discussed on order</li>
              <li>Optional insured delivery available — extra charges apply</li>
              <li>
                We are not responsible for any damage that occurs during
                delivery
              </li>
              <li>Client may also arrange pickup</li>
            </ul>
          </div>

          {/* INTERNATIONAL DELIVERY */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-xl font-bold font-[poppins] mb-2">
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
            <h3 className="text-xl font-bold font-[poppins] mb-2">
              After Production
            </h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Delivery expected within 7 days of completion</li>
              <li>Delays attract storage charges</li>
            </ul>
          </div>

          {/* INSTALLATIONS */}
          <div className="border-b border-base-200 pb-4">
            <h3 className="text-xl font-bold font-[poppins] mb-2">
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
            <h3 className="text-xl font-bold font-[poppins] mb-2">
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
            <h3 className="text-xl font-bold font-[poppins] mb-2">Complaints</h3>
            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
              <li>Must be reported within 24 hours of delivery</li>
              <li>Send complaints via WhatsApp or DM</li>
              <li>Include clear pictures if needed</li>
              <li>Complaints made after 24 hours will not be attended to.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
