import React from 'react';
import Hero1 from '../images/Hero1.png';
import Catalog1 from '../images/Catalog1.png';
import Catalog2 from '../images/Catalog2.png';
import Catalog3 from '../images/catalog3.png';
import Catalog4 from '../images/Catalog4.png';
import Catalog5 from '../images/catalog5.png';
import Catalog6 from '../images/catalog6.png';
import Catalog7 from '../images/catalog7.png';

const ECatalog = () => {
  return (
    <div className="pt-16">
      <div className="relative">
        <img src={Hero1} alt="" className="object-cover h-40 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
          <h1 className="absolute bottom-14 left-1/2 -translate-x-1/2 mt-20 w-full mb-2 text-3xl font-bold text-center text-base-100 font-[poppins]">
            E-Catalog
          </h1>
        </div>
      </div>
      <div className="w-full justify-center flex p-4">
        <div className="w-full justify-center grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 space-y-10 gap-x-5">
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.canva.com/design/DAGgzt2IPKU/AU0atAFcQs4hbMc3Nq8EBA/view?utm_content=DAGgzt2IPKU&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hc50235b6dc"
          >
            <img src={Catalog1} alt="" className="h-120 w-full" />
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.canva.com/design/DAGdrFUJioo/ItITpEt__8yU2gkomQ-C1w/view?utm_content=DAGdrFUJioo&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h2d1af101e8"
          >
            <img src={Catalog2} alt="" className="h-120 w-full" />
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.canva.com/design/DAGio2UBGXk/H7b14-nXZuNGT0ayp4zPbQ/view?utm_content=DAGio2UBGXk&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h624a40729c"
          >
            <img src={Catalog3} alt="" className="h-120 w-full" />
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.canva.com/design/DAGdz03XQzg/00w2z02d7N2wCKi0MjLQLw/view?utm_content=DAGdz03XQzg&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h4df3562abb"
          >
            <img src={Catalog4} alt="" className="h-120 w-full" />
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.canva.com/design/DAGeIqF0Bj0/D910Xr0AIl2vkVg6UZ8H2g/view?utm_content=DAGeIqF0Bj0&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h8991cd158a"
          >
            <img src={Catalog5} alt="" className="h-120 w-full" />
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.canva.com/design/DAGdrqYfdWA/HG1XliO1dx_I6x25FSciAQ/view?utm_content=DAGdrqYfdWA&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h95f49d776d"
          >
            <img src={Catalog6} alt="" className="h-120 w-full" />
          </a>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.canva.com/design/DAGdrl0Dk3A/v_OpFjL1bcZl6b9vYXLvpw/view?utm_content=DAGdrl0Dk3A&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h7ce4fa6605"
          >
            <img src={Catalog7} alt="" className="h-120 w-full" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ECatalog;
