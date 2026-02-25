'use client';

import React, { useEffect, useState } from 'react';
import { Unplug, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const OfflineBanner: React.FC = () => {
  const [mode, setMode] = useState<'LIVE' | 'OFFLINE'>('LIVE');

  useEffect(() => {
    const handleModeChange = (e: any) => {
      setMode(e.detail);
    };

    window.addEventListener('system-mode-change', handleModeChange);
    return () => window.removeEventListener('system-mode-change', handleModeChange);
  }, []);

  if (mode === 'LIVE') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-orange-600 text-white"
      >
        <div className="max-w-7xl mx-auto py-2 px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-orange-800">
              <Unplug className="h-4 w-4 text-white" aria-hidden="true" />
            </span>
            <p className="ml-3 font-medium text-white truncate">
              <span className="md:hidden">Offline Demo Mode active.</span>
              <span className="hidden md:inline">
                <strong>Offline Demo Mode:</strong> Database connection lost. Data will not be saved permanently.
              </span>
            </p>
          </div>
          <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
            <div className="flex items-center space-x-2 px-4 py-1 border border-transparent rounded-md shadow-sm text-xs font-medium text-orange-600 bg-white">
              <Zap className="h-3 w-3" />
              Auto-reconnecting...
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OfflineBanner;
