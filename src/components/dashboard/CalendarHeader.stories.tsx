import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { CalendarHeader } from './CalendarHeader';

const meta = {
  title: 'Dashboard/CalendarHeader',
  component: CalendarHeader,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    monthCursor: {
      control: 'date',
      description: 'The month being displayed',
    },
    selectedDayStatus: {
      description: 'Status of the selected day (completed/total sessions)',
    },
    onPrevMonth: {
      action: 'prev-month',
      description: 'Callback when previous month button is clicked',
    },
    onNextMonth: {
      action: 'next-month',
      description: 'Callback when next month button is clicked',
    },
    onJumpToday: {
      action: 'jump-today',
      description: 'Callback when today button is clicked',
    },
  },
} satisfies Meta<typeof CalendarHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default - current month
export const Default: Story = {
  args: {
    monthCursor: new Date(2026, 1, 1), // February 2026
    selectedDayStatus: { completed: 0, total: 0, slots: [] },
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onJumpToday: () => {},
  },
};

// With day status - no sessions
export const NoSessions: Story = {
  args: {
    monthCursor: new Date(2026, 1, 14),
    selectedDayStatus: { completed: 0, total: 0, slots: [] },
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onJumpToday: () => {},
  },
};

// With day status - 1 of 2 completed
export const PartiallyCompleted: Story = {
  args: {
    monthCursor: new Date(2026, 1, 14),
    selectedDayStatus: { completed: 1, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: true, absent: false }, { slotKey: "PM" as const, expected: true, completed: false, absent: false }] },
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onJumpToday: () => {},
  },
};

// With day status - all completed
export const AllCompleted: Story = {
  args: {
    monthCursor: new Date(2026, 1, 14),
    selectedDayStatus: { completed: 2, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: true, absent: false }, { slotKey: "PM" as const, expected: true, completed: true, absent: false }] },
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onJumpToday: () => {},
  },
};

// Different months
export const January: Story = {
  args: {
    monthCursor: new Date(2026, 0, 1),
    selectedDayStatus: { completed: 1, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: true, absent: false }, { slotKey: "PM" as const, expected: true, completed: false, absent: false }] },
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onJumpToday: () => {},
  },
};

export const December: Story = {
  args: {
    monthCursor: new Date(2025, 11, 1),
    selectedDayStatus: { completed: 2, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: true, absent: false }, { slotKey: "PM" as const, expected: true, completed: true, absent: false }] },
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onJumpToday: () => {},
  },
};

// Interactive demo
export const Interactive: Story = {
  args: {
    monthCursor: new Date(),
    selectedDayStatus: { completed: 1, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: true, absent: false }, { slotKey: "PM" as const, expected: true, completed: false, absent: false }] },
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onJumpToday: () => {},
  },
  render: () => {
    const [monthCursor, setMonthCursor] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState({
      completed: 1,
      total: 2,
      slots: [{ slotKey: "AM" as const, expected: true, completed: true, absent: false }, { slotKey: "PM" as const, expected: true, completed: false, absent: false }],
    });

    const handlePrevMonth = () => {
      setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
      setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1));
    };

    const handleJumpToday = () => {
      setMonthCursor(new Date());
    };

    const cycleDayStatus = () => {
      if (selectedDay.total === 0) {
        setSelectedDay({ completed: 1, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: true, absent: false }, { slotKey: "PM" as const, expected: true, completed: false, absent: false }] });
      } else if (selectedDay.completed < selectedDay.total) {
        setSelectedDay({ completed: selectedDay.completed + 1, total: selectedDay.total, slots: selectedDay.slots.map((s, i) => i < selectedDay.completed + 1 ? { ...s, completed: true } : s) });
      } else {
        setSelectedDay({ completed: 0, total: 0, slots: [] });
      }
    };

    return (
      <div className="space-y-4">
        <CalendarHeader
          monthCursor={monthCursor}
          selectedDayStatus={selectedDay}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onJumpToday={handleJumpToday}
        />
        <div className="p-4 text-center space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Month: {monthCursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
            <p className="text-sm text-muted-foreground">
              Selected day status: {selectedDay.completed}/{selectedDay.total}
            </p>
          </div>
          <button
            onClick={cycleDayStatus}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            Cycle Day Status
          </button>
        </div>
      </div>
    );
  },
};

// Mobile responsive
export const MobileView: Story = {
  args: {
    monthCursor: new Date(2026, 1, 14),
    selectedDayStatus: { completed: 1, total: 2, slots: [{ slotKey: "AM" as const, expected: true, completed: true, absent: false }, { slotKey: "PM" as const, expected: true, completed: false, absent: false }] },
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onJumpToday: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
