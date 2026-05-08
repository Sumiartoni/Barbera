"use client";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: Direction;
  className?: string;
  amount?: number;
  once?: boolean;
}

const offset = (d: Direction) => {
  switch (d) {
    case "up": return { y: 40 };
    case "down": return { y: -40 };
    case "left": return { x: 40 };
    case "right": return { x: -40 };
    default: return {};
  }
};

export const Reveal = ({
  children,
  delay = 0,
  duration = 0.7,
  direction = "up",
  className,
  amount = 0.2,
  once = true,
}: RevealProps) => {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, ...(reduce ? {} : offset(direction)) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, delay, ease: [0.22, 1, 0.36, 1] },
    },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
    >
      {children}
    </motion.div>
  );
};

interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}

export const Stagger = ({ children, className, stagger = 0.08, delay = 0 }: StaggerProps) => {
  const variants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem = ({
  children,
  className,
  direction = "up",
}: {
  children: ReactNode;
  className?: string;
  direction?: Direction;
}) => {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, ...(reduce ? {} : offset(direction)) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
};

interface TiltProps {
  children: ReactNode;
  className?: string;
  max?: number;
}

export const Tilt = ({ children, className, max = 8 }: TiltProps) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1200px) rotateY(${px * max}deg) rotateX(${-py * max}deg)`;
  };
  const reset = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "perspective(1200px) rotateY(0deg) rotateX(0deg)";
  };

  return (
    <div
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1)", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
};
