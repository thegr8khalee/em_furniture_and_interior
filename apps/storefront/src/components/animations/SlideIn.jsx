// src/components/animations/SlideIn.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { elegantEase } from '../../lib/animations';

const SlideIn = ({
  children,
  direction = 'left',
  delay = 0,
  duration = 1,
  className = '',
  once = true,
  amount = 0.3,
  ...props
}) => {
  const offsets = {
    left: { x: -100, y: 0 },
    right: { x: 100, y: 0 },
    up: { x: 0, y: 80 },
    down: { x: 0, y: -80 },
  };

  const offset = offsets[direction] || offsets.left;

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, ease: elegantEase, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default SlideIn;
