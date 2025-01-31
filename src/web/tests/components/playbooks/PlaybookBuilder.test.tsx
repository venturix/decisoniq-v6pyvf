import React from 'react'; // ^18.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { vi } from 'vitest'; // ^0.34.0

import PlaybookBuilder from '../../src/components/playbooks/PlaybookBuilder';
import { usePlaybook } from '../../src/hooks/usePlaybook';
import { PlaybookStatus, PlaybookTriggerType } from '../../types/playbook';

// Mock the usePlaybook hook
vi.mock('../../src/hooks/usePlaybook');

// Mock data for testing
const mockPlaybook = {
  id: 'test-playbook-1',
  name: 'Test Playbook',
  description: 'Test playbook for validation',
  steps: [
    {
      stepId: 'step-1',
      actionType: 'condition',
      actionConfig: {
        field: 'riskScore',
        operator: 'gt',
        value: 80
      },
      nextStep: 'step-2',
      conditions: null
    },
    {
      stepId: 'step-2',
      actionType: 'action',
      actionConfig: {
        type: 'email',
        template: 'risk-alert'
      },
      nextStep: null,
      conditions: null
    }
  ],
  triggerType: PlaybookTriggerType.RISK_SCORE,
  triggerConditions: {
    threshold: 80
  },
  status: PlaybookStatus.DRAFT,
  createdAt: new Date('2024-01-20T00:00:00Z'),
  updatedAt: new Date('2024-01-20T00:00:00Z')
};

describe('PlaybookBuilder', () => {
  const mockOnSave = vi.fn();
  const mockCreatePlaybook = vi.fn();
  const mockUpdatePlaybook = vi.fn();
  const mockExecutePlaybook = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    (usePlaybook as jest.Mock).mockReturnValue({
      playbooks: [mockPlaybook],
      createPlaybook: mockCreatePlaybook,
      updatePlaybook: mockUpdatePlaybook,
      executePlaybook: mockExecutePlaybook
    });
  });

  it('should render empty builder in initial state', async () => {
    render(<PlaybookBuilder />);

    // Verify toolbar presence
    expect(screen.getByRole('application', { name: /playbook builder/i })).toBeInTheDocument();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();

    // Verify empty canvas state
    const canvas = screen.getByRole('region', { name: /playbook canvas/i });
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('aria-dropeffect', 'move');

    // Verify accessibility features
    const announcer = screen.getByRole('status');
    expect(announcer).toHaveClass('sr-only');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
  });

  it('should handle complete playbook creation workflow', async () => {
    render(<PlaybookBuilder onSave={mockOnSave} />);

    // Fill in playbook details
    await user.type(screen.getByLabelText(/playbook name/i), 'New Test Playbook');
    await user.type(screen.getByLabelText(/description/i), 'Test description');

    // Add trigger condition
    const triggerButton = screen.getByRole('button', { name: /add trigger/i });
    await user.click(triggerButton);
    await user.click(screen.getByRole('radio', { name: /risk score/i }));
    await user.type(screen.getByLabelText(/threshold/i), '80');

    // Add steps
    const addStepButton = screen.getByRole('button', { name: /add step/i });
    await user.click(addStepButton);
    
    // Configure first step
    const stepConfig = screen.getByTestId('step-config-0');
    await user.click(within(stepConfig).getByRole('radio', { name: /condition/i }));
    await user.type(within(stepConfig).getByLabelText(/field/i), 'riskScore');
    await user.type(within(stepConfig).getByLabelText(/value/i), '80');

    // Add second step
    await user.click(addStepButton);
    const step2Config = screen.getByTestId('step-config-1');
    await user.click(within(step2Config).getByRole('radio', { name: /action/i }));
    await user.selectOptions(within(step2Config).getByLabelText(/action type/i), 'email');

    // Save playbook
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreatePlaybook).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Test Playbook',
        description: 'Test description',
        triggerType: PlaybookTriggerType.RISK_SCORE,
        steps: expect.arrayContaining([
          expect.objectContaining({
            actionType: 'condition',
            actionConfig: expect.objectContaining({
              field: 'riskScore',
              value: 80
            })
          }),
          expect.objectContaining({
            actionType: 'action',
            actionConfig: expect.objectContaining({
              type: 'email'
            })
          })
        ])
      }));
    });
  });

  it('should validate playbook configuration', async () => {
    render(<PlaybookBuilder onSave={mockOnSave} />);

    // Try to save invalid playbook
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Verify validation errors
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/playbook must have a trigger condition/i)).toBeInTheDocument();
    expect(screen.getByText(/playbook must have at least 2 steps/i)).toBeInTheDocument();

    // Fix validation errors
    await user.type(screen.getByLabelText(/playbook name/i), 'Valid Playbook');
    await user.type(screen.getByLabelText(/description/i), 'Valid description');

    // Add trigger
    const triggerButton = screen.getByRole('button', { name: /add trigger/i });
    await user.click(triggerButton);
    await user.click(screen.getByRole('radio', { name: /risk score/i }));

    // Add required steps
    const addStepButton = screen.getByRole('button', { name: /add step/i });
    await user.click(addStepButton);
    await user.click(addStepButton);

    // Save valid playbook
    await user.click(saveButton);

    // Verify validation passes
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(mockCreatePlaybook).toHaveBeenCalled();
    });
  });

  it('should handle keyboard navigation and accessibility', async () => {
    render(<PlaybookBuilder initialPlaybook={mockPlaybook} />);

    // Test keyboard navigation between steps
    const steps = screen.getAllByRole('button', { name: /step/i });
    
    // Focus first step
    steps[0].focus();
    expect(document.activeElement).toBe(steps[0]);

    // Navigate with arrow keys
    fireEvent.keyDown(steps[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(steps[1]);

    fireEvent.keyDown(steps[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(steps[0]);

    // Test step selection with Enter
    fireEvent.keyDown(steps[0], { key: 'Enter' });
    expect(steps[0]).toHaveAttribute('aria-selected', 'true');

    // Verify ARIA attributes
    expect(screen.getByRole('application')).toHaveAttribute('aria-label', 'Playbook Builder');
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Playbook actions');
  });

  it('should handle auto-save functionality', async () => {
    vi.useFakeTimers();
    render(<PlaybookBuilder initialPlaybook={mockPlaybook} autoSave />);

    // Make changes to trigger auto-save
    await user.type(screen.getByLabelText(/playbook name/i), ' Updated');

    // Fast-forward timers
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(mockUpdatePlaybook).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Playbook Updated'
      }));
    });

    vi.useRealTimers();
  });
});