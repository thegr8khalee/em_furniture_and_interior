import React from 'react';
import { motion } from 'framer-motion';
import { luxuryEase, elegantEase } from '../lib/animations';
import { PageWrapper } from '../components/animations';
// import Hero1 from '../images/Hero1.png';
// import Catalog1 from '../images/Catalog1.png';
// import Catalog2 from '../images/Catalog2.png';
// import Catalog3 from '../images/catalog3.png';
// import Catalog4 from '../images/Catalog4.png';
// import Catalog5 from '../images/catalog5.png';
// import Catalog6 from '../images/catalog6.png';
// import Catalog7 from '../images/catalog7.png';

const ECatalog = () => {
  return (
    <PageWrapper>
    <div className="min-h-screen mt-16 bg-base-200 pt-16 pb-12">
      <div className="relative h-48 sm:h-64 overflow-hidden">
        <motion.img
          src={
            'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png'
          }
          alt=""
          className="object-cover h-full w-full"
          initial={{ scale: 1.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: luxuryEase }}
        />
        <div className="absolute inset-0 bg-primary/80 flex flex-col items-center justify-center">
          <motion.h1 className="font-heading text-3xl sm:text-4xl font-medium text-white text-center" initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, delay: 0.5, ease: elegantEase }}>
            E-Catalog
          </motion.h1>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { href: 'https://www.canva.com/design/DAGgzt2IPKU/AU0atAFcQs4hbMc3Nq8EBA/view?utm_content=DAGgzt2IPKU&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hc50235b6dc', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786999/Catalog1_bejxqc.png' },
            { href: 'https://www.canva.com/design/DAGdrFUJioo/ItITpEt__8yU2gkomQ-C1w/view?utm_content=DAGdrFUJioo&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h2d1af101e8', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787005/Catalog2_ugkaep.png' },
            { href: 'https://www.canva.com/design/DAGio2UBGXk/H7b14-nXZuNGT0ayp4zPbQ/view?utm_content=DAGio2UBGXk&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h624a40729c', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753786999/catalog3_eujykx.png' },
            { href: 'https://www.canva.com/design/DAGdz03XQzg/00w2z02d7N2wCKi0MjLQLw/view?utm_content=DAGdz03XQzg&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h4df3562abb', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787001/Catalog4_srii2m.png' },
            { href: 'https://www.canva.com/design/DAGeIqF0Bj0/D910Xr0AIl2vkVg6UZ8H2g/view?utm_content=DAGeIqF0Bj0&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h8991cd158a', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787000/catalog5_iqlfg8.png' },
            { href: 'https://www.canva.com/design/DAGdrqYfdWA/HG1XliO1dx_I6x25FSciAQ/view?utm_content=DAGdrqYfdWA&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h95f49d776d', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787000/catalog6_kenssv.png' },
            { href: 'https://www.canva.com/design/DAGdrl0Dk3A/v_OpFjL1bcZl6b9vYXLvpw/view?utm_content=DAGdrl0Dk3A&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h7ce4fa6605', img: 'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787002/catalog7_wi8ekz.png' },
          ].map((catalog, index) => (
            <motion.a
              key={index}
              target="_blank"
              rel="noopener noreferrer"
              href={catalog.href}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: luxuryEase }}
              whileHover={{ y: -5, boxShadow: '0 16px 32px rgba(0,0,0,0.1)' }}
            >
              <img
                src={catalog.img}
                alt=""
                className="w-full h-auto aspect-[3/4] object-cover shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border border-white/20"
              />
            </motion.a>
          ))}
        </div>
      </div>
    </div>
    </PageWrapper>
  );
};

export default ECatalog;
