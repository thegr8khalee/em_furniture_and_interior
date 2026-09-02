// src/components/animations/GoldDivider.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { elegantEase } from '../../lib/animations';

const GoldDivider = ({
  className = '',
  delay = 0.2,
  once = true,
  ...props
}) => {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={{ once, amount: 0.5 }}
      transition={{
        duration: 0.8,
        ease: elegantEase,
        delay,
      }}
      style={{ originX: 0.5 }}
      className={`divider-gold ${className}`}
      {...props}
    />
  );
};

export default GoldDivider;
