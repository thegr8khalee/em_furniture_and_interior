import React from 'react';
import { motion } from 'framer-motion';
import { PageWrapper, FadeIn, SectionReveal, SlideIn, GoldDivider, StaggerContainer, StaggerItem } from '../components/animations';
import { luxuryEase, elegantEase } from '../lib/animations';

const AboutUs = () => {
  const departments = [
    { title: 'Design & Consultation', text: 'Our talented interior designers and consultants work closely with clients to understand their vision, offer expert advice, and translate ideas into stunning, functional designs.' },
    { title: 'Manufacturing & Craftsmanship', text: 'Highly skilled artisans and carpenters form the backbone of our local production. With years of experience, they meticulously craft each custom furniture piece ensuring precision, durability, and a flawless finish.' },
    { title: 'Logistics & Installation', text: 'Our efficient logistics team ensures timely delivery of both imported and locally manufactured goods. Our professional installers handle complex setups for a seamless integration.' },
    { title: 'Client Relations', text: 'A friendly and responsive team dedicated to providing excellent customer service, from initial inquiry to post-delivery support, ensuring a smooth and satisfying client journey.' },
  ];

  const team = [
    { name: 'Amina Abdulahi', role: 'CEO & Lead Interior Designer', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/CEO_ke8cr7.png', email: 'emfurnitureandinterior@gmail.com' },
    { name: 'Ibrahim Abdulahi', role: 'Head of Business Development & IT', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787007/ME_w9yhjj.png', email: 'kaliibro777@gmail.com' },
  ];

  return (
    <PageWrapper className="min-h-screen bg-white">
      {/* Hero Banner */}
      <div className="relative mt-16 h-48 sm:h-56 lg:h-64 overflow-hidden">
        <motion.img
          src="https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"
          alt="About"
          className="object-cover w-full h-full"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: elegantEase }}
        />
        <div className="absolute inset-0 bg-primary/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.h1
            className="font-heading text-3xl sm:text-4xl lg:text-5xl font-medium text-white"
            initial={{ opacity: 0, y: 30, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, ease: elegantEase, delay: 0.2 }}
          >
            About Us
          </motion.h1>
          <motion.p
            className="text-white/50 text-sm mt-2"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: luxuryEase, delay: 0.5 }}
          >
            Our story & commitment
          </motion.p>
        </div>
      </div>

      {/* Brand Statement */}
      <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn direction="up">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary">Who We Are</span>
            <h2 className="font-heading text-2xl sm:text-3xl font-medium text-neutral mt-2 mb-6">
              The Epitome of Luxury & Craftsmanship
            </h2>
          </FadeIn>
          <GoldDivider className="mb-6" />
          <FadeIn direction="up" delay={0.2}>
            <p className="text-neutral/60 text-sm sm:text-base leading-relaxed">
              At EM Group Limited, we redefine elegance by blending exceptional craftsmanship, timeless design, and the finest materials to create luxury furniture and interior solutions that transform spaces into breathtaking havens. With a deep-rooted passion for aesthetics and functionality, we specialize in bespoke, handcrafted furniture, ensuring that every piece reflects sophistication, durability, and comfort.
            </p>
          </FadeIn>
        </div>
      </SectionReveal>

      {/* Vision & Mission */}
      <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20 bg-base-200">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <SlideIn direction="left">
            <div className="bg-white p-8 sm:p-10">
              <motion.div
                className="w-10 h-0.5 bg-secondary mb-5"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: elegantEase }}
                style={{ originX: 0 }}
              />
              <h3 className="font-heading text-xl font-medium text-neutral mb-3">Our Vision</h3>
              <p className="text-neutral/60 text-sm leading-relaxed">To be Nigeria's foremost luxury furniture and interior design firm, setting new benchmarks in quality, innovation, and exclusivity.</p>
            </div>
          </SlideIn>
          <SlideIn direction="right" delay={0.15}>
            <div className="bg-white p-8 sm:p-10">
              <motion.div
                className="w-10 h-0.5 bg-secondary mb-5"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: elegantEase, delay: 0.15 }}
                style={{ originX: 0 }}
              />
              <h3 className="font-heading text-xl font-medium text-neutral mb-3">Our Mission</h3>
              <p className="text-neutral/60 text-sm leading-relaxed">To elevate living spaces through world-class furniture and interior designs, offering our clients the perfect blend of comfort, prestige, and functionality.</p>
            </div>
          </SlideIn>
        </div>
      </SectionReveal>

      {/* Team */}
      <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20">
        <div className="text-center mb-12">
          <FadeIn direction="up">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary">Leadership</span>
            <h2 className="font-heading text-2xl sm:text-3xl font-medium text-neutral mt-2">Meet Our Team</h2>
          </FadeIn>
          <GoldDivider className="mt-4" />
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-10 max-w-3xl mx-auto">
          {team.map((m, i) => (
            <FadeIn key={m.name} direction="up" delay={i * 0.2} className="text-center group">
              <div className="relative overflow-hidden w-60 h-60 sm:w-64 sm:h-64 mx-auto mb-5">
                <motion.img
                  src={m.img}
                  className="w-full h-full object-cover"
                  alt={m.name}
                  whileHover={{ scale: 1.06 }}
                  transition={{ duration: 0.5, ease: luxuryEase }}
                />
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-all duration-300"></div>
              </div>
              <h4 className="font-heading text-lg font-medium text-neutral">{m.name}</h4>
              <p className="text-neutral/50 text-sm mt-1 mb-2">{m.role}</p>
              <a className="text-secondary text-xs font-semibold tracking-wider uppercase hover:underline" href={`mailto:${m.email}`}>Contact</a>
            </FadeIn>
          ))}
        </div>
      </SectionReveal>

      {/* Departments */}
      <SectionReveal className="py-16 sm:py-20 px-6 sm:px-10 lg:px-20 bg-base-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <FadeIn direction="up">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary">Our Expertise</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-medium text-neutral mt-2">Departments</h2>
            </FadeIn>
            <GoldDivider className="mt-4" />
          </div>
          <StaggerContainer staggerDelay={0.12} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {departments.map((d, i) => (
              <StaggerItem key={d.title} direction="scale">
                <motion.div
                  className="bg-white p-7"
                  whileHover={{ y: -4, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}
                  transition={{ duration: 0.3, ease: luxuryEase }}
                >
                  <motion.div
                    className="w-8 h-0.5 bg-secondary mb-4"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: elegantEase, delay: 0.2 + i * 0.08 }}
                    style={{ originX: 0 }}
                  />
                  <h3 className="font-heading text-base font-medium text-neutral mb-2">{d.title}</h3>
                  <p className="text-neutral/50 text-sm leading-relaxed">{d.text}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </SectionReveal>
    </PageWrapper>
  );
};

export default AboutUs;