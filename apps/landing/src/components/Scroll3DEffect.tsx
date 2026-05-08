import { useEffect, useRef, ReactNode } from "react";
import { motion, useScroll, useTransform, useReducedMotion, MotionValue } from "framer-motion";

interface Scroll3DSectionProps {
  children: ReactNode;
  className?: string;
  depth?: number; // 1-10, intensity of 3D effect
  direction?: "left" | "right" | "center";
}

export const Scroll3DSection = ({
  children,
  className = "",
  depth = 5,
  direction = "center",
}: Scroll3DSectionProps) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const intensity = depth / 10;

  const rotateX = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    reduce ? [0, 0, 0, 0] : [8 * intensity, 0, 0, -8 * intensity]
  );

  const rotateY = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    reduce
      ? [0, 0, 0, 0]
      : direction === "left"
      ? [-6 * intensity, 0, 0, 6 * intensity]
      : direction === "right"
      ? [6 * intensity, 0, 0, -6 * intensity]
      : [0, 0, 0, 0]
  );

  const scale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    reduce ? [1, 1, 1, 1] : [0.92, 1, 1, 0.92]
  );

  const opacity = useTransform(
    scrollYProgress,
    [0, 0.15, 0.85, 1],
    [0.3, 1, 1, 0.3]
  );

  const translateZ = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    reduce ? [0, 0, 0, 0] : [-60 * intensity, 0, 0, -60 * intensity]
  );

  return (
    <div ref={ref} className={`scroll-3d-wrapper ${className}`}>
      <motion.div
        style={{
          rotateX,
          rotateY,
          scale,
          opacity,
          z: translateZ,
          transformPerspective: 1200,
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

interface ParallaxLayerProps {
  children: ReactNode;
  speed?: number; // negative = slower, positive = faster
  className?: string;
}

export const ParallaxLayer = ({
  children,
  speed = 0.5,
  className = "",
}: ParallaxLayerProps) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? [0, 0] : [-100 * speed, 100 * speed]
  );

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
};

// Hook for smooth scroll-based progress indicator
export const useScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  return scrollYProgress;
};

// Component to show a progress bar at the top of the page
export const ScrollProgressBar = () => {
  const progress = useScrollProgress();
  const scaleX = useTransform(progress, [0, 1], [0, 1]);

  return (
    <motion.div
      className="scroll-progress-bar"
      style={{ scaleX, transformOrigin: "left" }}
    />
  );
};
