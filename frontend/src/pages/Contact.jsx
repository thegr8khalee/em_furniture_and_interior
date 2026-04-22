// src/pages/Contact.jsx
import React, { useEffect, useState } from 'react';
import { Clock3, Mail, MapPin, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { axiosInstance } from '../lib/axios.js';

void motion;
import { useAuthStore } from '../store/useAuthStore.js';
import { PageWrapper, FadeIn, SlideIn } from '../components/animations';
import { luxuryEase } from '../lib/animations';
import { Button, Card, Input, PageHeader, Textarea } from '../components/ui';
import SEO from '../components/SEO';
import { localBusinessJsonLd, breadcrumbJsonLd } from '../lib/seo';

const contactItems = [
  {
    label: 'Email',
    value: 'emfurnitureandinterior@gmail.com',
    href: 'mailto:emfurnitureandinterior@gmail.com',
    icon: Mail,
  },
  {
    label: 'Phone',
    value: '+234 903 769 1860',
    href: 'tel:+2349037691860',
    icon: Phone,
  },
  {
    label: 'Address',
    value: 'C16 Bamaiyi Road, Kaduna, Nigeria.',
    icon: MapPin,
  },
  {
    label: 'Hours',
    value: 'Open 24/7',
    icon: Clock3,
  },
];

const socialLinks = [
  {
    img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/whatsapp_4401461_vssasq.png',
    href: 'https://wa.me/2349037691860',
    label: 'WhatsApp',
  },
  {
    img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787005/ig_sb3dpj.png',
    href: 'https://www.instagram.com/em_furniture_and_interior',
    label: 'Instagram',
  },
  {
    img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/tik-tok_4782345_1_smgzmi.png',
    href: 'https://www.tiktok.com/@em_furniture_nd_interior',
    label: 'TikTok',
  },
  {
    img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/twitter_5968830_duuupi.png',
    href: 'https://x.com/___Emine_',
    label: 'X',
  },
];

const Contact = () => {
  const { authUser } = useAuthStore();
  const [formData, setFormData] = useState({
    name: authUser?.username || '',
    email: authUser?.email || '',
    phoneNumber: authUser?.phoneNumber || '',
    subject: '',
    message: '',
  });
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!authUser) return;

    setFormData((prev) => ({
      ...prev,
      name: prev.name || authUser.username || '',
      email: prev.email || authUser.email || '',
      phoneNumber: prev.phoneNumber || authUser.phoneNumber || '',
    }));
  }, [authUser]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);

    try {
      const res = await axiosInstance.post('/contact', formData);
      toast.success(res.data.message || 'Message sent successfully!');
      setFormData({
        name: authUser?.username || '',
        email: authUser?.email || '',
        phoneNumber: authUser?.phoneNumber || '',
        subject: '',
        message: '',
      });
    } catch (error) {
      console.error('Error sending contact message:', error);
      toast.error(
        error.response?.data?.message || 'Failed to send message. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <PageWrapper className="min-h-screen mt-16 bg-white">
      <SEO
        title="Contact Us"
        description="Contact EM Furniture & Interior at C16 Bamaiyi Road, Kaduna, Nigeria. Call +234 903 769 1860 or email emfurnitureandinterior@gmail.com. Open 24/7 for inquiries and bespoke design consultations."
        canonical="/contact"
        jsonLd={[
          localBusinessJsonLd(),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Contact', path: '/contact' },
          ]),
        ]}
      />
      <PageHeader
        title="Contact Us"
        subtitle="We'd love to hear from you"
        image="https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"
        alt="Luxury furniture showroom"
      />

      <div className="content-shell section-shell">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          <SlideIn direction="left" className="lg:col-span-3">
            <Card className="surface-elevated space-y-6" padding="p-6 sm:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Send a message
                </p>
                <h2 className="mt-2 font-heading text-3xl font-semibold text-neutral">
                  Let’s discuss your space
                </h2>
                <p className="mt-2 text-sm text-neutral/65">
                  Share your idea, request, or product question and our team will get back to you promptly.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Input
                    id="name"
                    name="name"
                    label="Name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    label="Email"
                    placeholder="you@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <Input
                  id="phoneNumber"
                  type="tel"
                  name="phoneNumber"
                  label="Phone"
                  placeholder="Your phone number"
                  pattern="[0-9]*"
                  minLength="10"
                  maxLength="14"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                />

                <Input
                  id="subject"
                  name="subject"
                  label="Subject"
                  placeholder="e.g. Product Inquiry"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />

                <Textarea
                  id="message"
                  name="message"
                  label="Message"
                  placeholder="Tell us what you need..."
                  value={formData.message}
                  onChange={handleChange}
                  rows="6"
                  className="resize-none"
                  required
                />

                <Button type="submit" isLoading={isSending}>
                  Send Message
                </Button>
              </form>
            </Card>
          </SlideIn>

          <SlideIn direction="right" delay={0.15} className="lg:col-span-2">
            <Card className="surface-elevated space-y-6" padding="p-6 sm:p-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Get in touch
                </p>
                <h2 className="mt-2 font-heading text-3xl font-semibold text-neutral">
                  Reach us directly
                </h2>
              </div>

              <div className="space-y-4">
                {contactItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <FadeIn key={item.label} direction="up" delay={index * 0.08}>
                      <div className="flex items-start gap-3 border-b border-base-300 pb-4 last:border-b-0 last:pb-0">
                        <div className="mt-0.5 border border-secondary/30 bg-secondary/10 p-2 text-secondary">
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral/55">
                            {item.label}
                          </p>
                          {item.href ? (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block text-sm text-neutral/75 hover:text-secondary"
                            >
                              {item.value}
                            </a>
                          ) : (
                            <p className="mt-1 text-sm text-neutral/75">{item.value}</p>
                          )}
                        </div>
                      </div>
                    </FadeIn>
                  );
                })}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                  Follow Us
                </p>
                <div className="flex gap-3">
                  {socialLinks.map((social, index) => (
                    <motion.a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center border border-base-300 bg-base-100 hover:border-secondary hover:bg-secondary/10"
                      aria-label={social.label}
                      whileHover={{ scale: 1.08, y: -2 }}
                      whileTap={{ scale: 0.94 }}
                      initial={{ opacity: 0, scale: 0.92 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + index * 0.06, duration: 0.35, ease: luxuryEase }}
                    >
                      <img src={social.img} alt={social.label} className="size-5" />
                    </motion.a>
                  ))}
                </div>
              </div>
            </Card>
          </SlideIn>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Contact;
