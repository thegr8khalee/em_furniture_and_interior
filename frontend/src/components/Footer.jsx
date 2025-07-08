import React from 'react';
import whatsapp from '../images/whatsapp_4401461.png';
import ig from '../images/ig.png';
import tiktok from '../images/tik-tok_4782345 (1).png';
import x from '../images/twitter_5968830.png';
import { useNavigate } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();

  const handleAboutUsClick = () => {
    navigate('/aboutUS');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleTermsClick = () => {
    navigate('/terms');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handlePrivacyClick = () => {
    navigate('/privacy');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const handleContactClick = () => {
    navigate('/contact');
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);
  };

  const whatsappPhoneNumber = '2349037691860'; // REPLACE WITH YOUR ACTUAL PHONE NUMBER
  // Your preset message (URL-encoded)
  const presetMessage = encodeURIComponent(
    "Hello, I'm interested in your products. I saw your website and would like to inquire more."
  );

  const whatsappLink = `https://wa.me/${whatsappPhoneNumber}?text=${presetMessage}`;

  return (
    <footer className="footer footer-horizontal footer-center bg-base-200 text-base-content rounded p-10 pb-30">
      <nav className="grid grid-flow-col gap-4">
        <button
          className="link link-hover"
          onClick={() => handleAboutUsClick()}
        >
          About us
        </button>
        <button
          className="link link-hover"
          onClick={() => handleContactClick()}
        >
          Contact us
        </button>
        <button className="link link-hover" onClick={() => handleTermsClick()}>
          Terms & Conditions
        </button>
        <button
          className="link link-hover"
          onClick={() => handlePrivacyClick()}
        >
          Privacy policy
        </button>
      </nav>
      <nav>
        <div className="grid grid-flow-col gap-4">
          <a href={whatsappLink}>
            <img src={whatsapp} alt="" className="size-10" />
          </a>
          <a href="https://www.instagram.com/em_furniture_and_interior?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==">
            <img src={ig} alt="" className="size-10" />
          </a>
          <a href="https://www.tiktok.com/@em_furniture_nd_interior?is_from_webapp=1&sender_device=pc">
            <img src={tiktok} alt="" className="size-10" />
          </a>
          <a href="https://x.com/___Emine_">
            <img src={x} alt="" className="size-10 rounded-full" />
          </a>
        </div>
      </nav>
      <aside>
        <p>
          Copyright © {new Date().getFullYear()} - All right reserved by EM
          Group
        </p>
      </aside>
    </footer>
  );
};

export default Footer;
