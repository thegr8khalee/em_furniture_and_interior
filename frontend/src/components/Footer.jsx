import React from 'react';
import whatsapp from '../images/whatsapp_4401461.png';
import ig from '../images/ig.png';
import tiktok from '../images/tik-tok_4782345 (1).png';
import x from '../images/twitter_5968830.png';

const Footer = () => {
  return (
    <footer className="footer footer-horizontal footer-center bg-base-200 text-base-content rounded p-10 pb-30">
      <nav className="grid grid-flow-col gap-4">
        <a className="link link-hover">About us</a>
        <a className="link link-hover">Contact us</a>
        <a className="link link-hover">Terms & Conditions</a>
      </nav>
      <nav>
        <div className="grid grid-flow-col gap-4">
          <a>
            <img src={whatsapp} alt="" className="size-10" />
          </a>
          <a>
            <img src={ig} alt="" className="size-10" />
          </a>
          <a>
            <img src={tiktok} alt="" className="size-10" />
          </a>
          <a>
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
