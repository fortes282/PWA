"use client";

import { useEffect, useState } from "react";

/** Barvy konfety — odpovídají paletě Přístav Radosti */
const COLORS = ["#FF6B6B", "#FFD93D", "#102A43", "#6BCB77", "#0EA5E9"];
const PARTICLE_COUNT = 35;

interface Particle {
  id: number;
  x: number;
  size: number;
  color: string;
  delay: number;
  drift: number;
  rotation: number;
  rounded: boolean;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: 4 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    delay: Math.random() * 0.6,
    drift: (Math.random() - 0.5) * 60,
    rotation: Math.random() * 360,
    rounded: Math.random() > 0.5,
  }));
}

interface ConfettiCelebrationProps {
  active: boolean;
  duration?: number;
}

export default function ConfettiCelebration({
  active,
  duration = 2000,
}: ConfettiCelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }
    setParticles(generateParticles());
    const timer = setTimeout(() => setParticles([]), duration + 600);
    return () => clearTimeout(timer);
  }, [active, duration]);

  if (particles.length === 0) return null;

  const durationSec = duration / 1000;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className={p.rounded ? "rounded-full" : ""}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: -10,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: 0,
            animation: `confetti-fall ${durationSec}s ease-in ${p.delay}s forwards`,
            // Proměnné pro CSS animaci — drift a rotace
            ["--drift" as string]: `${p.drift}px`,
            ["--rotation" as string]: `${p.rotation}deg`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) translateX(0) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translateY(calc(100vh + 20px)) translateX(var(--drift)) rotate(var(--rotation));
          }
        }
      `}</style>
    </div>
  );
}
