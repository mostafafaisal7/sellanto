import { useState, useRef, useEffect } from 'react';
import { CheckCircleIcon, XMarkIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelections?: number;
  maxSelectionsForPreset?: number; // Limit only preset options, custom entries are unlimited
  placeholder?: string;
  label: string;
  required?: boolean;
  allowCustom?: boolean;
  onAddCustom?: (value: string) => void;
  customSelected?: string[];
  onRemoveCustom?: (index: number) => void;
  icon?: React.ComponentType<{ className?: string }>;
}

export function SearchableMultiSelect({
  options,
  selected,
  onChange,
  maxSelections,
  maxSelectionsForPreset,
  placeholder = 'Search...',
  label,
  required = false,
  allowCustom = false,
  onAddCustom,
  customSelected = [],
  onRemoveCustom,
  icon: Icon,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Use maxSelectionsForPreset if provided (unlimited custom), otherwise use maxSelections (old behavior)
  const presetLimit = maxSelectionsForPreset ?? maxSelections;
  const hasUnlimitedCustom = maxSelectionsForPreset !== undefined;

  const totalSelected = selected.length + customSelected.length;
  const presetSelected = selected.filter((v) => v !== 'Other').length;

  // Can add more preset options if under preset limit
  const canAddMorePreset = !presetLimit || presetSelected < presetLimit;

  // Can add custom: always true if unlimited custom, otherwise check total
  const canAddCustomEntries = hasUnlimitedCustom || (!maxSelections || totalSelected < maxSelections);

  const hasOther = selected.includes('Other');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search query
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (value: string) => {
    if (value === 'Other') {
      // Toggle Other option - doesn't count toward preset limit
      if (selected.includes('Other')) {
        onChange(selected.filter((v) => v !== 'Other'));
      } else {
        onChange([...selected, 'Other']);
      }
    } else {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        // Check if can add more preset options
        if (canAddMorePreset) {
          onChange([...selected, value]);
        }
      }
    }
  };

  const handleAddCustom = () => {
    if (customInput.trim() && onAddCustom && canAddCustomEntries) {
      onAddCustom(customInput.trim());
      setCustomInput('');
    }
  };

  const getDisplayText = () => {
    if (totalSelected === 0) return placeholder;
    const displaySelected = selected.filter((v) => v !== 'Other');
    if (displaySelected.length === 0 && customSelected.length === 0) {
      return placeholder;
    }
    const allItems = [...displaySelected, ...customSelected];
    if (allItems.length === 1) return allItems[0];
    if (allItems.length === 2) return allItems.join(', ');
    return `${allItems.length} selected`;
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-text-secondary mb-2">
        {Icon && <Icon className="w-4 h-4 inline mr-2 -mt-0.5" />}
        {label} {required && <span className="text-red-400">*</span>}
        {hasUnlimitedCustom && presetLimit && (
          <span className="text-xs text-text-muted ml-2">
            (Select up to {presetLimit} from list, add unlimited custom)
          </span>
        )}
        {!hasUnlimitedCustom && maxSelections && (
          <span className="text-xs text-text-muted ml-2">(Select up to {maxSelections})</span>
        )}
      </label>

      {/* Selected items display */}
      {totalSelected > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected
            .filter((v) => v !== 'Other')
            .map((value) => {
              const option = options.find((opt) => opt.value === value);
              return (
                <span
                  key={value}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary"
                >
                  {option?.label || value}
                  <button
                    type="button"
                    onClick={() => handleToggle(value)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          {customSelected.map((value, i) => (
            <span
              key={`custom-${i}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary"
            >
              {value}
              <button
                type="button"
                onClick={() => onRemoveCustom?.(i)}
                className="hover:text-red-400 transition-colors"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
          isOpen
            ? 'border-primary bg-primary/5'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={totalSelected === 0 ? 'text-text-muted' : 'text-text-secondary'}>
            {getDisplayText()}
          </span>
          <MagnifyingGlassIcon className="w-5 h-5 text-text-muted" />
        </div>
      </button>

      {totalSelected > 0 && (
        <p className="text-xs text-text-muted mt-1">
          {hasUnlimitedCustom && presetLimit ? (
            <>
              {presetSelected} of {presetLimit} preset selected
              {customSelected.length > 0 && `, ${customSelected.length} custom added`}
            </>
          ) : maxSelections ? (
            `${totalSelected} of ${maxSelections} selected`
          ) : (
            `${totalSelected} selected`
          )}
        </p>
      )}

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-dark-800 border border-white/10 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Search input */}
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Options list */}
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-muted text-sm">
                  No options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = selected.includes(opt.value);
                  // Disable if: not selected AND (can't add more preset OR it's "Other" and no space)
                  const isDisabled = !isSelected && (
                    opt.value === 'Other' ? false : !canAddMorePreset
                  );

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => !isDisabled && handleToggle(opt.value)}
                      disabled={isDisabled}
                      className={`w-full text-left px-4 py-3 transition-all ${
                        isSelected
                          ? 'bg-primary/20 text-primary'
                          : isDisabled
                          ? 'text-text-muted opacity-50 cursor-not-allowed'
                          : 'text-text-secondary hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{opt.label}</span>
                        {isSelected && <CheckCircleIcon className="w-5 h-5" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Custom input section */}
            {allowCustom && hasOther && (
              <div className="p-3 border-t border-white/10 bg-dark-700/50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={`Add custom ${label.toLowerCase()}...`}
                    className="input flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustom();
                      }
                    }}
                    disabled={!canAddCustomEntries}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    disabled={!canAddCustomEntries || !customInput.trim()}
                    className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SearchableMultiSelect;
