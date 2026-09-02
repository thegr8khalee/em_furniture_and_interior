import { motion } from 'framer-motion';
import { GoldDivider } from '../animations';

void motion;
import { elegantEase, luxuryEase } from '../../lib/animations';

const PageHeader = ({
  title,
  subtitle,
  image,
  alt,
  heightClass = 'h-48 sm:h-56 lg:h-64',
  overlayClassName = 'bg-primary/80',
}) => {
  return (
    <div className={`relative overflow-hidden ${heightClass}`}>
      {image ? (
        <motion.img
          src={image}
          alt={alt || title}
          className="h-full w-full object-cover"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.2, ease: elegantEase }}
        />
      ) : (
        <div className="h-full w-full bg-primary" />
      )}
      <div className={`absolute inset-0 ${overlayClassName}`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: elegantEase }}
        >
          <GoldDivider className="mb-4" />
        </motion.div>
        <motion.h1
          className="font-heading text-3xl font-bold text-white sm:text-4xl lg:text-5xl"
          initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: elegantEase, delay: 0.1 }}
        >
          {title}
        </motion.h1>
        {subtitle ? (
          <motion.p
            className="mt-2 text-sm text-white/70 sm:text-base"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: luxuryEase, delay: 0.25 }}
          >
            {subtitle}
          </motion.p>
        ) : null}
      </div>
    </div>
  );
};

export default PageHeader;
