import React from 'react';
import Hero1 from '../images/Hero1.png';
import ME from '../images/ME.png';
import CEO from '../images/CEO.png';

const AboutUs = () => {
  return (
    <div className="pt-16">
      <div className="relative">
        <img src={Hero1} alt="" className="object-cover h-40 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
          <h1 className="absolute bottom-10 left-1/2 -translate-x-1/2 mt-20 w-full mb-2 text-3xl font-bold text-center text-base-100 font-[poppins]">
            About Us
          </h1>
        </div>
      </div>
      <div className="w-full items-center justify-center flex">
        <section className="text-center w-full mt-10 px-4 max-w-5xl">
          <div className="text-3xl font-bold font-[poppins]">
            EM Group Limited – The Epitome of Luxury & Craftsmanship
          </div>
          <div className="font-[montserrat] pt-4">
            At EM Group Limited, we redefine elegance by blending exceptional
            craftsmanship, timeless design, and the finest materials to create
            luxury furniture and interior solutions that transform spaces into
            breathtaking havens. With a deep-rooted passion for aesthetics and
            functionality, we specialize in bespoke, handcrafted furniture,
            ensuring that every piece reflects sophistication, durability, and
            comfort. Each creation is meticulously crafted by master artisans,
            using only premium wood, rich fabrics, and exquisite finishes,
            making every piece a statement of prestige.
          </div>
          <div className="text-3xl font-bold font-[poppins] py-4">
            Our Vision
          </div>
          <div className="font-[montserrat]">
            To be Nigeria’s foremost luxury furniture and interior design firm,
            setting new benchmarks in quality, innovation, and exclusivity.
          </div>
          <div className="text-3xl font-bold font-[poppins] py-4">
            Our Mission
          </div>
          <div className="font-[montserrat]">
            To elevate living spaces through world-class furniture and interior
            designs, offering our clients the perfect blend of comfort,
            prestige, and functionality.
          </div>
          <div className="text-3xl font-bold font-[poppins] py-4">
            Meet Our Team
          </div>
          <div className="font-[montserrat] flex flex-col items-center sm:flex-row justify-center">
            <div className="m-5 text-start">
              <img src={CEO} className="w-70 h-70 object-cover" alt="CEO" />
              <p>Amina Abdulahi</p>
              <p>CEO & Visionary</p>
              <p>Lead Interior Designer</p>
              <a className="text-info" href="emfurnitureandinterior@gmail.com">
                Contact
              </a>
            </div>
            <div className="m-5 text-start">
              <img src={ME} className="w-70 h-70 object-cover" alt="Me" />
              <p>Ibrahim Abdulahi</p>
              <p>Head of Business Development</p>
              <p>Head of IT department</p>
              <a className="text-info" href="mailto:kaliibro777A@gmail.com">
                Contact
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutUs;
