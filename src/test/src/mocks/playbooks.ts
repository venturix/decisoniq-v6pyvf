// External imports
import { faker } from '@faker-js/faker'; // v8.x
import { v4 as uuidv4 } from 'uuid'; // v9.x

// Internal imports
import { 
  Playbook,
  PlaybookStatus,
  PlaybookTriggerType,
  PlaybookStep
} from '../../web/src/types/playbook';

/**
 * Creates a mock playbook step with realistic test data
 */
const createMockStep = (stepNumber: number): PlaybookStep => ({
  stepId: uuidv4(),
  actionType: faker.helpers.arrayElement([
    'SEND_EMAIL',
    'CREATE_TASK',
    'SCHEDULE_MEETING',
    'UPDATE_RISK_SCORE',
    'NOTIFY_CSM'
  ]),
  actionConfig: {
    template: faker.helpers.arrayElement(['RISK_ALERT', 'QUARTERLY_REVIEW', 'TRAINING_INVITE']),
    priority: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
    dueIn: faker.number.int({ min: 1, max: 14 })
  },
  nextStep: stepNumber < 3 ? uuidv4() : null,
  conditions: stepNumber > 1 ? {
    previousStepStatus: 'completed',
    customerResponse: true
  } : null
});

/**
 * Creates a mock playbook with realistic test data and optional overrides
 */
export const createMockPlaybook = (overrides?: Partial<Playbook>): Playbook => {
  const basePlaybook: Playbook = {
    id: uuidv4(),
    name: `${faker.company.name()} Success Plan`,
    description: faker.lorem.paragraph(),
    steps: Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, (_, i) => 
      createMockStep(i)
    ),
    triggerType: faker.helpers.arrayElement([
      PlaybookTriggerType.RISK_SCORE,
      PlaybookTriggerType.HEALTH_SCORE,
      PlaybookTriggerType.MANUAL,
      PlaybookTriggerType.SCHEDULED
    ]),
    triggerConditions: {
      threshold: faker.number.int({ min: 1, max: 100 }),
      operator: faker.helpers.arrayElement(['>', '<', '>=', '<=']),
      duration: faker.number.int({ min: 1, max: 30 })
    },
    status: faker.helpers.weightedArrayElement([
      { weight: 3, value: PlaybookStatus.ACTIVE },
      { weight: 1, value: PlaybookStatus.DRAFT },
      { weight: 1, value: PlaybookStatus.ARCHIVED }
    ]),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent()
  };

  return {
    ...basePlaybook,
    ...overrides
  };
};

/**
 * Creates an array of varied mock playbooks for bulk testing
 */
export const createMockPlaybookList = (
  count: number,
  baseOverrides?: Partial<Playbook>
): Playbook[] => {
  if (count < 1) {
    throw new Error('Count must be greater than 0');
  }

  return Array.from({ length: count }, () => {
    const variations: Partial<Playbook> = {
      ...baseOverrides,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };
    return createMockPlaybook(variations);
  });
};

/**
 * Default mock playbook instance for basic testing scenarios
 */
export const mockPlaybook: Playbook = createMockPlaybook({
  status: PlaybookStatus.ACTIVE,
  triggerType: PlaybookTriggerType.RISK_SCORE,
  steps: [
    {
      stepId: uuidv4(),
      actionType: 'SEND_EMAIL',
      actionConfig: {
        template: 'RISK_ALERT',
        priority: 'HIGH',
        dueIn: 1
      },
      nextStep: uuidv4(),
      conditions: null
    },
    {
      stepId: uuidv4(),
      actionType: 'CREATE_TASK',
      actionConfig: {
        template: 'QUARTERLY_REVIEW',
        priority: 'MEDIUM',
        dueIn: 7
      },
      nextStep: null,
      conditions: {
        previousStepStatus: 'completed',
        customerResponse: true
      }
    }
  ]
});