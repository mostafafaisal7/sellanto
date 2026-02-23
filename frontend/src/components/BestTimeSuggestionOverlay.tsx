import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClockIcon,
  InformationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface TimeSlot {
  day_of_week: number;
  hour_utc: number;
  score: number;
  source: 'own_data' | 'industry_default';
}

interface Props {
  brandId: number;
  platform?: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS_START = 6;
const HOURS_END = 23;
const HOUR_LABELS: string[] = [];
for (let h = HOURS_START; h <= HOURS_END; h++) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  HOUR_LABELS.push(`${display}${suffix}`);
}

function getScoreColor(score: number): string {
  if (score >= 0.75) return 'bg-green-500';
  if (score >= 0.45) return 'bg-yellow-500';
  return 'bg-gray-600';
}

function getScoreOpacity(score: number): number {
  return Math.max(0.15, Math.min(1, score));
}

function getScoreLabel(score: number): string {
  if (score >= 0.75) return 'Best';
  if (score >= 0.45) return 'Good';
  return 'Average';
}

export function BestTimeSuggestionOverlay({ brandId, platform }: Props) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    slot: TimeSlot;
    x: number;
    y: number;
  } | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState(platform || '');
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBestTimes();
  }, [brandId, selectedPlatform]);

  const loadBestTimes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (selectedPlatform) params.platform = selectedPlatform;
      const res = await api.get(`/brands/${brandId}/best-times/`, { params });
      setSlots(res.data);
    } catch (err) {
      console.error('Failed to load best times:', err);
      setError('Failed to load posting time data');
    }
    setLoading(false);
  };

  const getSlotScore = (day: number, hour: number): TimeSlot | undefined => {
    return slots.find((s) => s.day_of_week === day && s.hour_utc === hour);
  };

  const handleCellHover = (
    e: React.MouseEvent<HTMLDivElement>,
    day: number,
    hour: number
  ) => {
    const slot = getSlotScore(day, hour);
    if (slot) {
      const rect = e.currentTarget.getBoundingClientRect();
      const gridRect = gridRef.current?.getBoundingClientRect();
      if (gridRect) {
        setTooltip({
          slot,
          x: rect.left - gridRect.left + rect.width / 2,
          y: rect.top - gridRect.top - 8,
        });
      }
    }
  };

  const handleCellLeave = () => {
    setTooltip(null);
  };

  const topSlots = [...slots]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-800 border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
            <ClockIcon className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-sm">
              Best Posting Times
            </h3>
            <p className="text-xs text-text-muted">
              Optimal time slots based on engagement data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="text-xs bg-dark-700 border border-white/10 rounded-lg px-2 py-1.5 text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Platforms</option>
            <option value="twitter">Twitter/X</option>
            <option value="linkedin">LinkedIn</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
          <button
            onClick={loadBestTimes}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-3" />
            <p className="text-sm text-text-secondary">
              Analyzing engagement patterns...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <InformationCircleIcon className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={loadBestTimes}
              className="mt-3 text-xs text-primary-400 hover:text-primary-300"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Top Recommended Slots */}
            {topSlots.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-text-secondary mb-2">
                  Top recommended slots
                </p>
                <div className="flex flex-wrap gap-2">
                  {topSlots.map((slot, idx) => {
                    const h = slot.hour_utc;
                    const suffix = h >= 12 ? 'PM' : 'AM';
                    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
                    return (
                      <motion.div
                        key={`${slot.day_of_week}-${slot.hour_utc}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg"
                      >
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-[10px] font-bold text-green-400">
                          {idx + 1}
                        </div>
                        <span className="text-xs font-medium text-green-400">
                          {DAY_LABELS[slot.day_of_week]} {display}:00{suffix}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {(slot.score * 100).toFixed(0)}%
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grid */}
            <div ref={gridRef} className="relative overflow-x-auto">
              {/* Tooltip */}
              <AnimatePresence>
                {tooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute z-20 pointer-events-none"
                    style={{
                      left: tooltip.x,
                      top: tooltip.y,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="bg-dark-700 border border-white/10 rounded-lg px-3 py-2 shadow-xl text-center">
                      <p className="text-xs font-medium text-text-primary">
                        Score: {(tooltip.slot.score * 100).toFixed(0)}% -{' '}
                        {getScoreLabel(tooltip.slot.score)}
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Source:{' '}
                        {tooltip.slot.source === 'own_data'
                          ? 'Your Data'
                          : 'Industry Default'}
                      </p>
                      <div
                        className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-dark-700 border-r border-b border-white/10 rotate-45"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-12 p-1" />
                    {HOUR_LABELS.map((label, idx) => (
                      <th
                        key={idx}
                        className="p-1 text-[9px] font-medium text-text-muted text-center min-w-[28px]"
                      >
                        {idx % 2 === 0 ? label : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAY_LABELS.map((day, dayIdx) => (
                    <tr key={dayIdx}>
                      <td className="p-1 text-[10px] font-medium text-text-secondary text-right pr-2">
                        {day}
                      </td>
                      {Array.from(
                        { length: HOURS_END - HOURS_START + 1 },
                        (_, i) => HOURS_START + i
                      ).map((hour) => {
                        const slot = getSlotScore(dayIdx, hour);
                        const score = slot?.score || 0;
                        return (
                          <td key={hour} className="p-0.5">
                            <div
                              onMouseEnter={(e) =>
                                handleCellHover(e, dayIdx, hour)
                              }
                              onMouseLeave={handleCellLeave}
                              className={`w-full aspect-square min-w-[22px] rounded-sm cursor-pointer transition-all hover:ring-1 hover:ring-white/30 ${
                                score > 0 ? getScoreColor(score) : 'bg-dark-700'
                              }`}
                              style={{
                                opacity: score > 0 ? getScoreOpacity(score) : 0.3,
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-green-500" />
                  <span className="text-[10px] text-text-muted">Best</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-yellow-500 opacity-70" />
                  <span className="text-[10px] text-text-muted">Good</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gray-600 opacity-50" />
                  <span className="text-[10px] text-text-muted">Average</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                  <span className="text-[10px] text-text-muted">Your data</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  <span className="text-[10px] text-text-muted">
                    Industry default
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default BestTimeSuggestionOverlay;
