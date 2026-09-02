// src/components/animations/SectionReveal.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { elegantEase, luxuryEase } from '../../lib/animations';

const SectionReveal = ({
  children,
  className = '',
  delay = 0,
  once = true,
  amount = 0.15,
  ...props
}) => {
  return (
    <section className={className} {...props}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once, amount }}
        transition={{
          duration: 0.7,
          ease: elegantEase,
          delay,
        }}
      >
        {children}
      </motion.div>
    </section>
  );
};

export default SectionReveal;
