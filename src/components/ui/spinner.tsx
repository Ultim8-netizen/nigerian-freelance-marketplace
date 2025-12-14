"use client"; // MANDATORY: Marks the file as a Client Component because it uses hooks (useEffect, useState)

import { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants, Transition } from "framer-motion";
import { cn } from "@/lib/utils";

// Define the cubic bezier array for "easeInOut" to satisfy strict TypeScript checking within Variants
const easeInOut: Transition["ease"] = [0.42, 0, 0.58, 1];
// Define the cubic bezier array for "linear"
const easeLinear: Transition["ease"] = [0, 0, 1, 1];


// ============================================================================
// Compact Inline Spinner (for buttons, etc.)
// ============================================================================
export function Spinner({ className }: { className?: string }) {
  const dotColors = ["#3B82F6", "#EF4444", "#A855F7"];
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    // This interval controls the color cycling effect
    const interval = setInterval(() => {
      setActiveDot(prev => (prev + 1) % 3);
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: easeLinear, // Using type-safe array for linear ease
      }}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="60"
          strokeDashoffset="20"
          strokeLinecap="round"
          animate={{
            stroke: dotColors[activeDot],
          }}
          transition={{
            duration: 0.4,
            ease: easeInOut, // Using type-safe array for easeInOut
          }}
        />
      </svg>
    </motion.span>
  );
}

// ============================================================================
// Full-screen F9 Premium Spinner
// ============================================================================
export default function F9SpinnerPro() {
  const dotColors = ["#3B82F6", "#EF4444", "#A855F7"];
  const totalCyclesForTagline = 3;

  const [activeDot, setActiveDot] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);

  // Derived: avoids setState inside effect
  const showTagline = cycleCount >= totalCyclesForTagline;

  useEffect(() => {
    // Controls the dot color and cycle count
    const interval = setInterval(() => {
      setActiveDot(prev => {
        const next = (prev + 1) % 3;
        if (next === 0) setCycleCount(c => c + 1); // Increment cycle count when dots loop
        return next;
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  // Slight oscillating scale on the whole F9 block
  const pulseVariants: Variants = {
    animate: {
      scale: [1, 1.06, 1],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        ease: easeInOut, // FIXED: Using array syntax for type safety
      },
    },
  };

  const taglineVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 1.2,
        repeat: Infinity,
        repeatType: "mirror" as const,
        ease: easeInOut, // FIXED: Using array syntax for type safety
      },
    },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <motion.div
        variants={pulseVariants}
        animate="animate"
        className="text-6xl font-bold font-mono flex items-center space-x-2"
      >
        <span className="flex items-center">
          F9
          <motion.span
            key={activeDot}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              color: dotColors[activeDot],
            }}
            transition={{
              duration: 0.35,
              ease: easeInOut,
            }}
            className="ml-1"
          >
            •
          </motion.span>
        </span>

        {/* Smooth blinking using framer-motion instead of CSS */}
        <motion.span
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            repeatType: "loop" as const,
            ease: easeInOut,
          }}
        >
          |
        </motion.span>
      </motion.div>

      <AnimatePresence>
        {showTagline && (
          <motion.div
            className="mt-6 text-2xl font-semibold"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={taglineVariants}
          >
            Hustle Forward
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}