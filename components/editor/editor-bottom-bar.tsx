'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shuffle, Undo2, Redo2 } from 'lucide-react';
import { FaGithub } from 'react-icons/fa';
import { motion, useSpring, useTransform } from 'motion/react';

function useGitHubStars() {
  const [stars, setStars] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStars = async () => {
      try {
        const response = await fetch("https://api.github.com/repos/KartikLabhshetwar/stage");
        if (response.ok) {
          const data = await response.json();
          setStars(data.stargazers_count);
        }
      } catch (error) {
        console.error("Failed to fetch GitHub stars:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStars();
  }, []);

  return { stars, isLoading };
}

function AnimatedCounter({ value }: { value: number }) {
  const spring = useSpring(0, {
    damping: 30,
    stiffness: 100,
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  );

  return <motion.span>{display}</motion.span>;
}

export function EditorBottomBar() {
  const { stars, isLoading } = useGitHubStars();

  return (
    <div className="h-14 bg-background border-t border-border flex items-center justify-between px-3 sm:px-4 md:px-6">
      {/* Left side - Open Source and Shuffle */}
      <div className="flex items-center gap-2 sm:gap-3">
      </div>

      {/* Right side - Undo/Redo and Sponsor */}
      <div className="flex items-center gap-2">
      </div>
    </div>
  );
}
