// src/pages/Contact.jsx
import React, { useState } from 'react'; // Import useState
import { Loader2 } from 'lucide-react'; // Import Loader2 for loading state
import { toast } from 'react-hot-toast'; // Import toast for notifications
import { axiosInstance } from '../lib/axios.js'; // Your configured Axios instance
// import Hero1 from '../images/Hero1.png';
// import whatsapp from '../images/whatsapp_4401461.png'; // Assuming correct path
// import ig from '../images/ig.png';
// import tiktok from '../images/tik-tok_4782345 (1).png';
// import x from '../images/twitter_5968830.png';
import { useAuthStore } from '../store/useAuthStore.js';

const Contact = () => {
  const { authUser } = useAuthStore();
  console.log(authUser);
  const [formData, setFormData] = useState({
    name: authUser?.username || '',
    email: authUser?.email || '',
    phoneNumber: authUser?.phoneNumber || '',
    subject: '',
    message: '',
  });
  const [isSending, setIsSending] = useState(false); // Loading state for form submission

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);

    try {
      const res = await axiosInstance.post('/contact', formData);
      toast.success(res.data.message || 'Message sent successfully!');
      setFormData({ name: '', email: '', subject: '', message: '' }); // Clear form
    } catch (error) {
      console.error('Error sending contact message:', error);
      toast.error(
        error.response?.data?.message ||
          'Failed to send message. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="pt-16">
      <div className="relative">
        <img
          src={
            'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png'
          }
          alt="Contact Hero"
          className="object-cover h-40 w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center text-base-100 font-[poppins]">
            Contact Us
          </h1>
        </div>
      </div>

      <div className="container mx-auto p-4 pt-0 sm:p-6 lg:p-8 my-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Form Section */}
          <div className="bg-base-100 px-4 pb-4 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold font-[poppins] mb-6">
              Send Us a Message
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="label">
                  <span className="label-text text-base-content">
                    Your Name
                  </span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Name Surname"
                  value={formData.name}
                  onChange={handleChange}
                  className="input input-bordered w-full rounded-md"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="label">
                  <span className="label-text text-base-content">
                    Your Email
                  </span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className="input input-bordered w-full rounded-md"
                  required
                />
              </div>
              <div>
                <label htmlFor="phoneNumber" className="label">
                  <span className="label-text text-base-content">
                    Your Phone Number
                  </span>
                </label>
                <input
                  type="tel"
                  className="input input-bordered w-full rounded-md"
                  required
                  name="phoneNumber"
                  placeholder="Phone"
                  pattern="[0-9]*"
                  minlength="10"
                  maxlength="14"
                  title="Must be at least 10 digits"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="subject" className="label">
                  <span className="label-text text-base-content">Subject</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="e.g Inquiry about products"
                  className="input input-bordered w-full rounded-md"
                  required
                />
              </div>
              <div>
                <label htmlFor="message" className="label">
                  <span className="label-text text-base-content">
                    Your Message
                  </span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Type your message here..."
                  className="textarea textarea-bordered h-32 w-full rounded-md"
                  required
                ></textarea>
              </div>
              <button
                type="submit"
                className="btn bg-primary w-full rounded-xl"
                disabled={isSending}
              >
                {isSending ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  'Send Message'
                )}
              </button>
            </form>
          </div>

          {/* Contact Information Section */}
          <div className="bg-base-100 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold font-[poppins] mb-6">
              Our Contact Details
            </h2>
            <div className="space-y-4 text-base-content">
              <div>
                <h3 className="font-bold text-lg">Email:</h3>
                <p>
                  <a
                    href="mailto:emfurnitureandinterior@gmial.com"
                    className=" hover:underline"
                  >
                    emfurnitureandinterior@gmail.com
                  </a>
                </p>
              </div>
              <div>
                <h3 className="font-bold text-lg">Phone:</h3>
                <p>
                  <a
                    href="tel:+2349037691860"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    +2349037691860
                  </a>
                </p>
              </div>
              <div>
                <h3 className="font-bold text-lg">Address:</h3>
                <p>C16 Bamaiyi Road, Kaduna, Nigeria.</p>
              </div>
              <div>
                <h3 className="font-bold text-lg">Business Hours:</h3>
                <p>Open 24/7</p>
              </div>
              <div>
                <h3 className="font-bold text-lg">Follow Us:</h3>
                <div className="flex space-x-4 mt-2">
                  <a
                    href="https://wa.me/2349037691860"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                  >
                    <img
                      src={
                        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/whatsapp_4401461_vssasq.png'
                      }
                      alt="WhatsApp"
                      className="size-10"
                    />
                  </a>
                  <a
                    href="https://www.instagram.com/em_furniture_and_interior?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                  >
                    <img
                      src={
                        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787005/ig_sb3dpj.png'
                      }
                      alt="Instagram"
                      className="size-10"
                    />
                  </a>
                  <a
                    href="https://www.tiktok.com/@em_furniture_nd_interior?is_from_webapp=1&sender_device=pc"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TikTok"
                  >
                    <img
                      src={
                        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/tik-tok_4782345_1_smgzmi.png'
                      }
                      alt="TikTok"
                      className="size-10"
                    />
                  </a>
                  <a
                    href="https://x.com/___Emine_"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="X (Twitter)"
                  >
                    <img
                      src={
                        'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786996/twitter_5968830_duuupi.png'
                      }
                      alt="X (Twitter)"
                      className="size-10 rounded-full"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
