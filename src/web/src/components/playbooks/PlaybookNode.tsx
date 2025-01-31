import React, { useState, useCallback, memo, useRef, useEffect } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import Card from '../common/Card';
import { PlaybookStep, PlaybookTriggerType } from '../../types/playbook';
import { useTheme } from '../../lib/blitzy/theme';

// Constants for node dimensions and styling
const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;
const CONNECTION_RADIUS = 6;
const FOCUS_VISIBLE_OUTLINE = '2px solid var(--theme-primary)';
const HIGH_CONTRAST_COLORS = {
  background: '#000',
  text: '#fff',
  border: '#fff',
};

interface PlaybookNodeProps {
  step: PlaybookStep;
  isSelected?: boolean;
  onSelect: (stepId: string) => void;
  onConnect: (fromId: string, toId: string) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'high-contrast';
  isHighContrast?: boolean;
}

/**
 * PlaybookNode component represents an individual node in the playbook builder interface.
 * Implements WCAG 2.1 Level AA compliance with high-contrast support and keyboard navigation.
 */
export const PlaybookNode: React.FC<PlaybookNodeProps> = memo(({
  step,
  isSelected = false,
  onSelect,
  onConnect,
  className,
  isHighContrast = false,
}) => {
  const { theme } = useTheme();
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle keyboard navigation and selection
  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(step.stepId);
        break;
      case 'Tab':
        setIsFocused(true);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        // Handle arrow key navigation between nodes
        const nodes = document.querySelectorAll('[data-node-id]');
        const currentIndex = Array.from(nodes).findIndex(
          node => node.getAttribute('data-node-id') === step.stepId
        );
        let nextIndex = currentIndex;

        if (event.key === 'ArrowRight') nextIndex++;
        if (event.key === 'ArrowLeft') nextIndex--;
        if (event.key === 'ArrowUp') nextIndex -= Math.floor(NODE_WIDTH / NODE_HEIGHT);
        if (event.key === 'ArrowDown') nextIndex += Math.floor(NODE_WIDTH / NODE_HEIGHT);

        if (nextIndex >= 0 && nextIndex < nodes.length) {
          (nodes[nextIndex] as HTMLElement).focus();
        }
        break;
    }
  }, [step.stepId, onSelect]);

  // Handle node selection
  const handleSelect = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    onSelect(step.stepId);
    setIsFocused(true);
  }, [step.stepId, onSelect]);

  // Handle connection point interaction
  const handleConnectionStart = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setIsConnecting(true);
    document.addEventListener('mousemove', handleConnectionDrag);
    document.addEventListener('mouseup', handleConnectionEnd);
  }, []);

  const handleConnectionDrag = useCallback((event: MouseEvent) => {
    // Update connection line visualization
    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      // Update connection line position
    }
  }, []);

  const handleConnectionEnd = useCallback((event: MouseEvent) => {
    setIsConnecting(false);
    document.removeEventListener('mousemove', handleConnectionDrag);
    document.removeEventListener('mouseup', handleConnectionEnd);

    // Find target node and validate connection
    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const targetNodeId = targetElement?.closest('[data-node-id]')?.getAttribute('data-node-id');

    if (targetNodeId && targetNodeId !== step.stepId) {
      onConnect(step.stepId, targetNodeId);
    }
  }, [step.stepId, onConnect]);

  // Clean up event listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleConnectionDrag);
      document.removeEventListener('mouseup', handleConnectionEnd);
    };
  }, [handleConnectionDrag, handleConnectionEnd]);

  const nodeClasses = classNames(
    'playbook-node',
    'relative',
    'select-none',
    {
      'playbook-node--selected': isSelected,
      'playbook-node--focused': isFocused,
      'playbook-node--connecting': isConnecting,
      'playbook-node--high-contrast': isHighContrast,
    },
    className
  );

  return (
    <Card
      ref={nodeRef}
      className={nodeClasses}
      variant="elevated"
      data-node-id={step.stepId}
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        ...(isHighContrast && HIGH_CONTRAST_COLORS),
      }}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`${step.actionType} step`}
      onClick={handleSelect}
      onKeyDown={handleKeyboardNavigation}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      highContrast={isHighContrast}
    >
      <BlitzyUI.Flex direction="column" gap="sm">
        <BlitzyUI.Text
          variant="heading"
          size="sm"
          className={classNames('truncate', {
            'text-high-contrast': isHighContrast,
          })}
        >
          {step.actionType}
        </BlitzyUI.Text>
        
        {/* Connection points */}
        <div
          className="connection-point connection-point--input"
          role="button"
          tabIndex={0}
          aria-label="Input connection point"
          style={{
            width: CONNECTION_RADIUS * 2,
            height: CONNECTION_RADIUS * 2,
            borderRadius: CONNECTION_RADIUS,
          }}
        />
        <div
          className="connection-point connection-point--output"
          role="button"
          tabIndex={0}
          aria-label="Output connection point"
          onMouseDown={handleConnectionStart}
          onKeyDown={(e) => e.key === 'Enter' && handleConnectionStart(e as any)}
          style={{
            width: CONNECTION_RADIUS * 2,
            height: CONNECTION_RADIUS * 2,
            borderRadius: CONNECTION_RADIUS,
          }}
        />

        {/* Action configuration preview */}
        {step.actionConfig && (
          <BlitzyUI.Text
            size="xs"
            className={classNames('text-secondary truncate', {
              'text-high-contrast': isHighContrast,
            })}
          >
            {Object.entries(step.actionConfig)[0]?.[1]?.toString() || 'No configuration'}
          </BlitzyUI.Text>
        )}
      </BlitzyUI.Flex>
    </Card>
  );
});

PlaybookNode.displayName = 'PlaybookNode';

export default PlaybookNode;