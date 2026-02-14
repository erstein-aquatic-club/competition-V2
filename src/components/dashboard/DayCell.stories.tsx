import type { Meta, StoryObj } from '@storybook/react';
import { DayCell } from './DayCell';

const meta = {
  title: 'Dashboard/DayCell',
  component: DayCell,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    date: {
      control: 'date',
      description: 'The date this cell represents',
    },
    inMonth: {
      control: 'boolean',
      description: 'Whether the date is in the currently displayed month',
    },
    isToday: {
      control: 'boolean',
      description: 'Whether this is today',
    },
    isSelected: {
      control: 'boolean',
      description: 'Whether this date is selected',
    },
    isFocused: {
      control: 'boolean',
      description: 'Whether this cell has keyboard focus',
    },
    status: {
      description: 'Session completion status (completed/total)',
    },
    onClick: {
      action: 'clicked',
      description: 'Callback when cell is clicked',
    },
    onKeyDown: {
      action: 'keydown',
      description: 'Callback for keyboard navigation',
    },
  },
} satisfies Meta<typeof DayCell>;

export default meta;
type Story = StoryObj<typeof meta>;

// Rest day (no sessions)
export const RestDay: Story = {
  args: {
    date: new Date(2026, 1, 14),
    inMonth: true,
    isToday: false,
    isSelected: false,
    isFocused: false,
    status: { completed: 0, total: 0 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// No sessions completed
export const NoSessionsCompleted: Story = {
  args: {
    date: new Date(2026, 1, 14),
    inMonth: true,
    isToday: false,
    isSelected: false,
    isFocused: false,
    status: { completed: 0, total: 2 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// Partially completed (1 of 2)
export const PartiallyCompleted: Story = {
  args: {
    date: new Date(2026, 1, 14),
    inMonth: true,
    isToday: false,
    isSelected: false,
    isFocused: false,
    status: { completed: 1, total: 2 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// Fully completed
export const FullyCompleted: Story = {
  args: {
    date: new Date(2026, 1, 14),
    inMonth: true,
    isToday: false,
    isSelected: false,
    isFocused: false,
    status: { completed: 2, total: 2 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// Today (rest day)
export const Today: Story = {
  args: {
    date: new Date(),
    inMonth: true,
    isToday: true,
    isSelected: false,
    isFocused: false,
    status: { completed: 0, total: 0 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// Today with sessions
export const TodayWithSessions: Story = {
  args: {
    date: new Date(),
    inMonth: true,
    isToday: true,
    isSelected: false,
    isFocused: false,
    status: { completed: 1, total: 2 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// Selected day
export const Selected: Story = {
  args: {
    date: new Date(2026, 1, 14),
    inMonth: true,
    isToday: false,
    isSelected: true,
    isFocused: false,
    status: { completed: 1, total: 2 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// Focused (keyboard navigation)
export const Focused: Story = {
  args: {
    date: new Date(2026, 1, 14),
    inMonth: true,
    isToday: false,
    isSelected: false,
    isFocused: true,
    status: { completed: 1, total: 2 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// Out of month
export const OutOfMonth: Story = {
  args: {
    date: new Date(2026, 0, 30),
    inMonth: false,
    isToday: false,
    isSelected: false,
    isFocused: false,
    status: { completed: 1, total: 2 },
    onClick: () => {},
    onKeyDown: () => {},
  },
};

// All states comparison
export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 p-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Rest Day</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 1, 1)}
            inMonth={true}
            isToday={false}
            isSelected={false}
            isFocused={false}
            status={{ completed: 0, total: 0 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Not Started</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 1, 2)}
            inMonth={true}
            isToday={false}
            isSelected={false}
            isFocused={false}
            status={{ completed: 0, total: 2 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Partial (1/2)</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 1, 3)}
            inMonth={true}
            isToday={false}
            isSelected={false}
            isFocused={false}
            status={{ completed: 1, total: 2 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Complete (2/2)</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 1, 4)}
            inMonth={true}
            isToday={false}
            isSelected={false}
            isFocused={false}
            status={{ completed: 2, total: 2 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Today</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 1, 5)}
            inMonth={true}
            isToday={true}
            isSelected={false}
            isFocused={false}
            status={{ completed: 1, total: 2 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Selected</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 1, 6)}
            inMonth={true}
            isToday={false}
            isSelected={true}
            isFocused={false}
            status={{ completed: 1, total: 2 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Out of Month</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 0, 31)}
            inMonth={false}
            isToday={false}
            isSelected={false}
            isFocused={false}
            status={{ completed: 1, total: 2 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Focused</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 1, 7)}
            inMonth={true}
            isToday={false}
            isSelected={false}
            isFocused={true}
            status={{ completed: 1, total: 2 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-center">Completed + Today</p>
        <div className="w-20">
          <DayCell
            date={new Date(2026, 1, 8)}
            inMonth={true}
            isToday={true}
            isSelected={false}
            isFocused={false}
            status={{ completed: 2, total: 2 }}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        </div>
      </div>
    </div>
  ),
};

// Calendar grid simulation
export const CalendarGrid: Story = {
  render: () => {
    const days = Array.from({ length: 7 }, (_, i) => i + 1);
    const statuses = [
      { completed: 0, total: 0 }, // Rest
      { completed: 0, total: 2 }, // Not started
      { completed: 1, total: 2 }, // Partial
      { completed: 2, total: 2 }, // Complete
      { completed: 1, total: 2 }, // Partial
      { completed: 0, total: 0 }, // Rest
      { completed: 2, total: 2 }, // Complete
    ];

    return (
      <div className="w-80 grid grid-cols-7 gap-2 p-4 bg-card rounded-lg border">
        {days.map((day, index) => (
          <DayCell
            key={day}
            date={new Date(2026, 1, day)}
            inMonth={true}
            isToday={day === 4}
            isSelected={day === 2}
            isFocused={false}
            status={statuses[index]}
            onClick={() => {}}
            onKeyDown={() => {}}
          />
        ))}
      </div>
    );
  },
};
