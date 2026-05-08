import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef } from "react";

interface BarberPoleProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showGlow?: boolean;
}

const sizeMap = {
  sm: { width: 40, height: 120, capH: 16, bodyRadius: 12 },
  md: { width: 56, height: 170, capH: 20, bodyRadius: 16 },
  lg: { width: 72, height: 220, capH: 26, bodyRadius: 20 },
  xl: { width: 96, height: 300, capH: 34, bodyRadius: 26 },
};

const BarberPole = ({ className = "", size = "lg", showGlow = true }: BarberPoleProps) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const rotateY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 15]);

  const dims = sizeMap[size];
  const stripeWidth = dims.width * 0.65;
  const bodyHeight = dims.height - dims.capH * 2;

  return (
    <motion.div
      ref={ref}
      className={`barber-pole-container ${className}`}
      style={{
        width: dims.width,
        height: dims.height,
        rotateY,
        perspective: 800,
      }}
    >
      <div
        className="barber-pole"
        style={{
          width: dims.width,
          height: dims.height,
        }}
      >
        {/* Top cap (dome) */}
        <div
          className="barber-pole-cap barber-pole-cap-top"
          style={{
            width: dims.width,
            height: dims.capH,
            borderRadius: `${dims.bodyRadius}px ${dims.bodyRadius}px 0 0`,
          }}
        />

        {/* Main body with animated stripes */}
        <div
          className="barber-pole-body"
          style={{
            width: dims.width,
            height: bodyHeight,
            borderRadius: 0,
            overflow: "hidden",
          }}
        >
          {/* Glass cylinder effect */}
          <div className="barber-pole-glass" />

          {/* Animated stripes container */}
          <div
            className="barber-pole-stripes"
            style={{
              width: stripeWidth,
              left: `${(dims.width - stripeWidth) / 2}px`,
            }}
          >
            <svg
              width={stripeWidth}
              height={bodyHeight * 3}
              viewBox={`0 0 ${stripeWidth} ${bodyHeight * 3}`}
              className="barber-pole-svg"
              preserveAspectRatio="none"
            >
              <defs>
                <clipPath id={`pole-clip-${size}`}>
                  <rect x="0" y="0" width={stripeWidth} height={bodyHeight * 3} rx="0" />
                </clipPath>
              </defs>
              <g clipPath={`url(#pole-clip-${size})`}>
                {/* Generate repeating diagonal stripes */}
                {Array.from({ length: 40 }).map((_, i) => {
                  const spacing = stripeWidth * 0.7;
                  const offset = i * spacing;
                  return (
                    <g key={i}>
                      {/* Red stripe */}
                      <polygon
                        points={`${offset},0 ${offset + stripeWidth * 0.35},0 ${offset - bodyHeight * 0.35 + stripeWidth * 0.35},${bodyHeight * 3} ${offset - bodyHeight * 0.35},${bodyHeight * 3}`}
                        fill="#DC2626"
                        opacity="0.95"
                      />
                      {/* Blue stripe */}
                      <polygon
                        points={`${offset + stripeWidth * 0.35},0 ${offset + stripeWidth * 0.55},0 ${offset - bodyHeight * 0.35 + stripeWidth * 0.55},${bodyHeight * 3} ${offset - bodyHeight * 0.35 + stripeWidth * 0.35},${bodyHeight * 3}`}
                        fill="#1D4ED8"
                        opacity="0.9"
                      />
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Highlight / reflection overlay */}
          <div className="barber-pole-highlight" />
        </div>

        {/* Bottom cap */}
        <div
          className="barber-pole-cap barber-pole-cap-bottom"
          style={{
            width: dims.width,
            height: dims.capH,
            borderRadius: `0 0 ${dims.bodyRadius}px ${dims.bodyRadius}px`,
          }}
        />

        {/* Metal ball top */}
        <div
          className="barber-pole-ball barber-pole-ball-top"
          style={{
            width: dims.width * 0.45,
            height: dims.width * 0.45,
            top: -(dims.width * 0.45 * 0.4),
            left: (dims.width - dims.width * 0.45) / 2,
          }}
        />

        {/* Metal ball bottom */}
        <div
          className="barber-pole-ball barber-pole-ball-bottom"
          style={{
            width: dims.width * 0.45,
            height: dims.width * 0.45,
            bottom: -(dims.width * 0.45 * 0.4),
            left: (dims.width - dims.width * 0.45) / 2,
          }}
        />
      </div>

      {/* Glow effect */}
      {showGlow && (
        <div
          className="barber-pole-glow"
          style={{
            width: dims.width * 2,
            height: dims.height * 0.6,
            left: -(dims.width * 0.5),
            bottom: -(dims.height * 0.1),
          }}
        />
      )}
    </motion.div>
  );
};

export default BarberPole;
