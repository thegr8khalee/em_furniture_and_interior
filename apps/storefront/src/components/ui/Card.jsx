import { createElement } from 'react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const Card = ({
  as: Component = 'div',
  children,
  className = '',
  hover = false,
  padding = 'p-6',
  ...props
}) => {
  return createElement(
    Component,
    {
      className: cn(
        'border border-base-300 bg-white',
        hover && 'card-hover',
        padding,
        className
      ),
      ...props,
    },
    children
  );
};

export default Card;
