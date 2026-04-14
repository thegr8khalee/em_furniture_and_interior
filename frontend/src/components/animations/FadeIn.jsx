// src/components/animations/FadeIn.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { luxuryEase, elegantEase } from '../../lib/animations';

const directionOffsets = {
  up: { y: 40, x: 0 },
  down: { y: -40, x: 0 },
  left: { x: -60, y: 0 },
  right: { x: 60, y: 0 },
  none: { x: 0, y: 0 },
};

const FadeIn = ({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.8,
  className = '',
  once = true,
  amount = 0.2,
  blur = false,
  ...props
}) => {
  const offset = directionOffsets[direction] || directionOffsets.up;

  return (
    <motion.div
      initial={{
        opacity: 0,
        ...offset,
        ...(blur ? { filter: 'blur(4px)' } : {}),
      }}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
        ...(blur ? { filter: 'blur(0px)' } : {}),
      }}
      viewport={{ once, amount }}
      transition={{
        duration,
        ease: duration > 0.9 ? elegantEase : luxuryEase,
        delay,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default FadeIn;
