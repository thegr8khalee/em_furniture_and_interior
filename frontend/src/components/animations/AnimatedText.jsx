// src/components/animations/AnimatedText.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { elegantEase } from '../../lib/animations';

const AnimatedText = ({
  children,
  as: Component = 'h2',
  delay = 0,
  className = '',
  once = true,
  blur = true,
  ...props
}) => {
  const MotionComponent = motion.create(Component);

  return (
    <MotionComponent
      initial={{
        opacity: 0,
        y: 35,
        ...(blur ? { filter: 'blur(3px)' } : {}),
      }}
      whileInView={{
        opacity: 1,
        y: 0,
        ...(blur ? { filter: 'blur(0px)' } : {}),
      }}
      viewport={{ once, amount: 0.5 }}
      transition={{
        duration: 1,
        ease: elegantEase,
        delay,
      }}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};

export default AnimatedText;
