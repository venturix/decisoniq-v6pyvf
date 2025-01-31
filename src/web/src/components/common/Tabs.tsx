import React, { useCallback, useEffect, useRef, useState } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { useTheme } from '../../lib/blitzy/theme';
import { applyTheme } from '../../lib/blitzy/ui';
import type { BlitzyThemeConfig } from '../../types/blitzy';

// Tab item interface with enhanced accessibility support
export interface TabItem {
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

// Component props with comprehensive configuration options
export interface TabsProps {
  tabs: TabItem[];
  activeIndex: number;
  onChange: (index: number) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  'aria-label'?: string;
  themeOverride?: Partial<BlitzyThemeConfig>;
  disableAnimations?: boolean;
  transitionDuration?: number;
}

const DEFAULT_TRANSITION_DURATION = 200;

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeIndex,
  onChange,
  className,
  orientation = 'horizontal',
  size = 'md',
  'aria-label': ariaLabel = 'Tab navigation',
  themeOverride,
  disableAnimations = false,
  transitionDuration = DEFAULT_TRANSITION_DURATION,
}) => {
  const { theme } = useTheme();
  const [focusedIndex, setFocusedIndex] = useState(activeIndex);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabListRef = useRef<HTMLDivElement>(null);
  const isRTL = document.dir === 'rtl';

  // Initialize tab refs array
  useEffect(() => {
    tabRefs.current = tabRefs.current.slice(0, tabs.length);
  }, [tabs.length]);

  // Handle tab selection with accessibility announcements
  const handleTabChange = useCallback((index: number) => {
    if (index < 0 || index >= tabs.length) return;
    if (tabs[index].disabled) return;

    onChange(index);
    setFocusedIndex(index);

    // Announce tab change to screen readers
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = `${tabs[index].label} tab selected`;
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  }, [onChange, tabs]);

  // Comprehensive keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { key } = event;
    let newIndex = focusedIndex;

    switch (key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = focusedIndex - (isRTL && orientation === 'horizontal' ? -1 : 1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = focusedIndex + (isRTL && orientation === 'horizontal' ? -1 : 1);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = tabs.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleTabChange(focusedIndex);
        return;
      default:
        return;
    }

    // Handle circular navigation and skip disabled tabs
    while (newIndex >= 0 && newIndex < tabs.length) {
      if (!tabs[newIndex].disabled) {
        setFocusedIndex(newIndex);
        tabRefs.current[newIndex]?.focus();
        break;
      }
      newIndex += newIndex > focusedIndex ? 1 : -1;
    }
  }, [focusedIndex, handleTabChange, isRTL, orientation, tabs]);

  // Generate theme-aware class names
  const tabsClasses = classNames(
    'blitzy-tabs',
    `blitzy-tabs-${orientation}`,
    `blitzy-tabs-${size}`,
    {
      'blitzy-tabs-animated': !disableAnimations,
      'blitzy-tabs-rtl': isRTL,
    },
    className
  );

  // Apply theme styles
  const tabStyles = {
    '--tab-transition-duration': `${transitionDuration}ms`,
    ...themeOverride?.colors && Object.entries(themeOverride.colors).reduce((acc, [key, value]) => ({
      ...acc,
      [`--tab-color-${key}`]: value,
    }), {}),
  };

  return (
    <div className={tabsClasses} style={tabStyles} data-testid="tabs-container">
      {/* Tab List */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        className="blitzy-tabs-list"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={`tab-${index}`}
            ref={el => tabRefs.current[index] = el}
            role="tab"
            aria-selected={index === activeIndex}
            aria-disabled={tab.disabled}
            aria-label={tab.ariaLabel || tab.label}
            aria-controls={`tabpanel-${index}`}
            id={`tab-${index}`}
            tabIndex={index === focusedIndex ? 0 : -1}
            className={classNames('blitzy-tab', {
              'blitzy-tab-active': index === activeIndex,
              'blitzy-tab-disabled': tab.disabled,
              'blitzy-tab-with-icon': !!tab.icon,
            })}
            onClick={() => handleTabChange(index)}
            disabled={tab.disabled}
          >
            {tab.icon && <span className="blitzy-tab-icon">{tab.icon}</span>}
            <span className="blitzy-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="blitzy-tab-panels">
        {tabs.map((tab, index) => (
          <div
            key={`tabpanel-${index}`}
            role="tabpanel"
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            hidden={index !== activeIndex}
            className={classNames('blitzy-tab-panel', {
              'blitzy-tab-panel-active': index === activeIndex,
            })}
            tabIndex={0}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};

// Apply theme wrapper for consistent styling
export default applyTheme(Tabs, {} as BlitzyThemeConfig);