import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react';

void motion;
import { StaggerContainer, StaggerItem } from './animations';
import { luxuryEase } from '../lib/animations';
import { Button } from './ui';

const Footer = () => {
  const navigate = useNavigate();

  const handleNavClick = (path) => {
    navigate(path);
    setTimeout(() => window.scrollTo(0, 0), 10);
  };

  const whatsappPhoneNumber = '2349037691860';
  const presetMessage = encodeURIComponent(
    "Hello, I'm interested in your products. I saw your website and would like to inquire more."
  );
  const whatsappLink = `https://wa.me/${whatsappPhoneNumber}?text=${presetMessage}`;

  const footerLinks = {
    'Quick Links': [
      { label: 'Shop', path: '/shop' },
      { label: 'E-Catalog', path: '/e-catalog' },
      { label: 'Showroom', path: '/showroom' },
      { label: 'Projects', path: '/projects' },
      { label: 'Blog', path: '/blog' },
      { label: 'Track Order', path: '/track-order' },
    ],
    'Company': [
      { label: 'About Us', path: '/aboutUs' },
      { label: 'Contact Us', path: '/contact' },
      { label: 'Consultation', path: '/consultation' },
    ],
    'Legal': [
      { label: 'Terms & Conditions', path: '/terms' },
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'FAQs', path: '/faqs' },
    ],
  };

  const socials = [
    { img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/whatsapp_4401461_vssasq.png', href: whatsappLink, label: 'WhatsApp' },
    { img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787005/ig_sb3dpj.png', href: 'https://www.instagram.com/em_furniture_and_interior?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==', label: 'Instagram' },
    { img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/tik-tok_4782345_1_smgzmi.png', href: 'https://www.tiktok.com/@em_furniture_nd_interior?is_from_webapp=1&sender_device=pc', label: 'TikTok' },
    { img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/twitter_5968830_duuupi.png', href: 'https://x.com/___Emine_', label: 'X' },
  ];

  const contactDetails = [
    { icon: Mail, label: 'Email', value: 'emfurnitureandinterior@gmail.com' },
    { icon: Phone, label: 'Phone', value: '+234 903 769 1860' },
    { icon: MapPin, label: 'Location', value: 'C16 Bamaiyi Road, Kaduna, Nigeria' },
  ];

  return (
    <footer className="bg-primary text-white pb-28 lg:pb-0">
      {/* Top Accent Line */}
      <motion.div
        className="h-[0.05rem] bg-gradient-to-r from-secondary via-accent to-secondary"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: luxuryEase }}
      />

      <div className="mx-auto max-w-7xl px-6 pb-10 pt-16 sm:px-8 lg:px-12">
        <motion.div
          className="mb-12 grid gap-6 border border-white/15 bg-white/5 p-6 backdrop-blur-sm lg:grid-cols-[1.5fr_1fr] lg:items-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: luxuryEase }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
              Designer-led interiors
            </p>
            <h3 className="mt-2 font-heading text-3xl font-semibold text-white sm:text-4xl">
              Ready to elevate your space?
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
              From bespoke furniture to full interior styling, we help you create a refined home with warmth, clarity, and craftsmanship.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Button to="/consultation" variant="elegant" className="justify-center !bg-secondary !text-primary !border-secondary hover:!bg-accent hover:!border-accent">
              Book a consultation
            </Button>
            <Button to="/showroom" variant="elegant-outline" className="justify-center !border-secondary !text-secondary hover:!bg-secondary hover:!text-primary">
              Visit showroom
            </Button>
          </div>
        </motion.div>

        <StaggerContainer staggerDelay={0.15} delayChildren={0.1} className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <StaggerItem className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4 inline-flex border border-secondary/30 bg-secondary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
              EM Furniture & Interior
            </div>
            <p className="mb-6 max-w-xs text-sm leading-relaxed text-white/60">
              Transforming spaces with exceptional craftsmanship, timeless design, and the finest materials.
            </p>

            <div className="space-y-3 border-t border-white/10 pt-5">
              {contactDetails.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-3 text-sm text-white/70">
                    <span className="mt-0.5 border border-secondary/30 bg-secondary/10 p-2 text-secondary">
                      <Icon size={14} />
                    </span>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        {item.label}
                      </div>
                      <div>{item.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center gap-3">
              {socials.map((s, i) => (
                <motion.a
                  key={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  href={s.href}
                  className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 transition-colors duration-300 hover:border-secondary/50 hover:bg-secondary/15"
                  aria-label={s.label}
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: luxuryEase }}
                >
                  <img src={s.img} alt={s.label} className="size-5 object-contain" />
                </motion.a>
              ))}
            </div>
          </StaggerItem>

          {Object.entries(footerLinks).map(([title, links]) => (
            <StaggerItem key={title}>
              <h4 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">{title}</h4>
              <ul className="space-y-3">
                {links.map((link, i) => (
                  <motion.li
                    key={link.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease: luxuryEase }}
                  >
                    <button
                      onClick={() => handleNavClick(link.path)}
                      className="group inline-flex items-center gap-2 text-sm text-white/60 transition-colors duration-200 hover:text-secondary"
                    >
                      <span className="h-px w-3 bg-white/20 transition-all duration-200 group-hover:w-5 group-hover:bg-secondary" />
                      {link.label}
                    </button>
                  </motion.li>
                ))}
              </ul>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <motion.div
          className="mt-12 border-t border-white/10 pt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <p className="text-center text-xs tracking-wide text-white/40">
            &copy; {new Date().getFullYear()} EM Furniture and Interior. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
