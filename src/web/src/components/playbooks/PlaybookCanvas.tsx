import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { BlitzyUI, BlitzyCanvas, BlitzyTheme, BlitzyAccessibility } from '@blitzy/premium-ui'; // ^2.0.0
import { useAnalytics } from '@blitzy/analytics'; // ^1.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import PlaybookNode from './PlaybookNode';
import PlaybookToolbar from './PlaybookToolbar';
import { Playbook, PlaybookStep, PlaybookStatus } from '../../types/playbook';

// Constants for canvas configuration
const CANVAS_PADDING = 40;
const GRID_SIZE = 20;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const DEFAULT_ZOOM = 1;
const AUTO_SAVE_DELAY = 3000;
const MAX_UNDO_STACK = 50;

interface PlaybookCanvasProps {
  playbook: Playbook;
  onChange: (playbook: Playbook) => void;
  onSave: (playbook: Playbook) => Promise<void>;
  onActivate: (playbook: Playbook) => Promise<void>;
  className?: string;
  readOnly?: boolean;
  theme?: BlitzyTheme;
  initialZoom?: number;
}

interface CanvasState {
  selectedNodeId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  isConnecting: boolean;
  connectionStart: { x: number; y: number } | null;
}

const PlaybookCanvas: React.FC<PlaybookCanvasProps> = ({
  playbook,
  onChange,
  onSave,
  onActivate,
  className,
  readOnly = false,
  theme = 'light',
  initialZoom = DEFAULT_ZOOM,
}) => {
  const analytics = useAnalytics();
  const canvasRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef<Playbook[]>([]);
  const redoStackRef = useRef<Playbook[]>([]);
  
  // Canvas state management
  const [canvasState, setCanvasState] = useState<CanvasState>({
    selectedNodeId: null,
    zoom: initialZoom,
    pan: { x: 0, y: 0 },
    isDragging: false,
    isConnecting: false,
    connectionStart: null,
  });

  // Auto-save debounce timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  // Memoized grid configuration
  const gridConfig = useMemo(() => ({
    size: GRID_SIZE,
    color: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    snap: true,
  }), [theme]);

  // Handle node selection
  const handleNodeSelect = useCallback((stepId: string) => {
    setCanvasState(prev => ({
      ...prev,
      selectedNodeId: stepId,
    }));
    
    analytics.track('playbook_node_selected', { stepId });
  }, [analytics]);

  // Handle node connection
  const handleNodeConnect = useCallback((fromId: string, toId: string) => {
    if (readOnly) return;

    const updatedSteps = playbook.steps.map(step => {
      if (step.stepId === fromId) {
        return { ...step, nextStep: toId };
      }
      return step;
    });

    const updatedPlaybook = { ...playbook, steps: updatedSteps };
    onChange(updatedPlaybook);
    
    // Push to undo stack
    undoStackRef.current = [
      playbook,
      ...undoStackRef.current.slice(0, MAX_UNDO_STACK - 1),
    ];
    redoStackRef.current = [];

    analytics.track('playbook_nodes_connected', { fromId, toId });
  }, [playbook, onChange, readOnly, analytics]);

  // Handle node movement
  const handleNodeMove = useCallback((stepId: string, position: { x: number; y: number }) => {
    if (readOnly) return;

    const updatedSteps = playbook.steps.map(step => {
      if (step.stepId === stepId) {
        return { ...step, position };
      }
      return step;
    });

    const updatedPlaybook = { ...playbook, steps: updatedSteps };
    onChange(updatedPlaybook);

    // Schedule auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      onSave(updatedPlaybook);
    }, AUTO_SAVE_DELAY);
  }, [playbook, onChange, onSave, readOnly]);

  // Handle zoom controls
  const handleZoom = useCallback((delta: number) => {
    setCanvasState(prev => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + delta)),
    }));
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'z':
            if (event.shiftKey && redoStackRef.current.length > 0) {
              // Redo
              const [redoPlaybook, ...remainingRedo] = redoStackRef.current;
              redoStackRef.current = remainingRedo;
              undoStackRef.current = [playbook, ...undoStackRef.current];
              onChange(redoPlaybook);
            } else if (undoStackRef.current.length > 0) {
              // Undo
              const [undoPlaybook, ...remainingUndo] = undoStackRef.current;
              undoStackRef.current = remainingUndo;
              redoStackRef.current = [playbook, ...redoStackRef.current];
              onChange(undoPlaybook);
            }
            break;
          case 's':
            event.preventDefault();
            onSave(playbook);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [playbook, onChange, onSave]);

  // Clean up auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const canvasClasses = classNames(
    'playbook-canvas',
    {
      'playbook-canvas--readonly': readOnly,
      [`playbook-canvas--${theme}`]: true,
    },
    className
  );

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="playbook-canvas-error">
          An error occurred while rendering the playbook canvas.
          Please refresh the page or contact support if the issue persists.
        </div>
      }
    >
      <div className={canvasClasses} ref={canvasRef}>
        <PlaybookToolbar
          playbook={playbook}
          onSave={onSave}
          onActivate={onActivate}
          disabled={readOnly}
        />
        
        <BlitzyCanvas
          className="playbook-canvas__workspace"
          grid={gridConfig}
          zoom={canvasState.zoom}
          pan={canvasState.pan}
          onZoom={handleZoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        >
          {playbook.steps.map(step => (
            <PlaybookNode
              key={step.stepId}
              step={step}
              isSelected={step.stepId === canvasState.selectedNodeId}
              onSelect={handleNodeSelect}
              onConnect={handleNodeConnect}
              theme={theme}
            />
          ))}

          <BlitzyAccessibility
            announcements={{
              nodeSelected: 'Node selected: ${stepType}',
              nodesConnected: 'Connected ${fromType} to ${toType}',
              zoomChanged: 'Canvas zoom level: ${zoom}%',
            }}
          />
        </BlitzyCanvas>

        <div className="playbook-canvas__controls">
          <BlitzyUI.ButtonGroup>
            <BlitzyUI.Button
              icon="zoom-in"
              onClick={() => handleZoom(0.1)}
              disabled={canvasState.zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            />
            <BlitzyUI.Button
              icon="zoom-out"
              onClick={() => handleZoom(-0.1)}
              disabled={canvasState.zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            />
            <BlitzyUI.Button
              icon="reset"
              onClick={() => setCanvasState(prev => ({ ...prev, zoom: DEFAULT_ZOOM }))}
              aria-label="Reset zoom"
            />
          </BlitzyUI.ButtonGroup>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default PlaybookCanvas;