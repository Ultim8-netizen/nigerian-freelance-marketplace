// ============================================================================
// src/components/ui/spinner.tsx
// Premium typing loader: "F9▌"
// ============================================================================

// F9SpinnerPro.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function F9SpinnerPro() {
  const dotColors = ["#3B82F6", "#EF4444", "#A855F7"]; // blue, red, purple
  const totalCyclesForTagline = 3; // wait 3 cycles before showing tagline
  const [activeDot, setActiveDot] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot(prev => {
        const next = (prev + 1) % 3;
        if (next === 0) setCycleCount(c => c + 1);
        return next;
      });
    }, 400); // speed of leapfrogging

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cycleCount >= totalCyclesForTagline) {
      setShowTagline(true);
    }
  }, [cycleCount]);

  // Tagline variants for looping fade
  const taglineVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { duration: 1, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
    },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      {/* F9 Spinner */}
      <div className="text-6xl font-bold font-mono flex items-center space-x-2">
        <span>
          F9
          <span
            style={{ color: dotColors[activeDot] }}
            className="ml-1"
          >
            •
          </span>
        </span>
        <span className="animate-blink">|</span>
      </div>

      {/* Tagline revealed after cycles */}
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
