import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { BottomActionBar, type SaveState } from './BottomActionBar';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';

const meta = {
  title: 'Shared/BottomActionBar',
  component: BottomActionBar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    saveState: {
      control: { type: 'radio' },
      options: ['idle', 'saving', 'saved', 'error'],
      description: 'Current save state indicator',
    },
    saveMessage: {
      control: 'text',
      description: 'Custom message to display with save state',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for the outer container',
    },
    containerClassName: {
      control: 'text',
      description: 'Additional CSS classes for the inner container',
    },
  },
} satisfies Meta<typeof BottomActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default state with action buttons
export const Default: Story = {
  args: {
    saveState: 'idle',
    children: (
      <>
        <Button variant="outline" className="flex-1">
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button className="flex-1">
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </>
    ),
  },
};

// Saving state
export const Saving: Story = {
  args: {
    saveState: 'saving',
    saveMessage: 'Saving your changes...',
    children: (
      <>
        <Button variant="outline" className="flex-1" disabled>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button className="flex-1" disabled>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </>
    ),
  },
};

// Saved state (success)
export const Saved: Story = {
  args: {
    saveState: 'saved',
    saveMessage: 'Changes saved successfully',
    children: (
      <>
        <Button variant="outline" className="flex-1">
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button className="flex-1">
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </>
    ),
  },
};

// Error state
export const Error: Story = {
  args: {
    saveState: 'error',
    saveMessage: 'Failed to save changes',
    children: (
      <>
        <Button variant="outline" className="flex-1">
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button className="flex-1">
          <Save className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </>
    ),
  },
};

// Single button
export const SingleButton: Story = {
  args: {
    saveState: 'idle',
    children: (
      <Button className="w-full">
        <Save className="mr-2 h-4 w-4" />
        Save Changes
      </Button>
    ),
  },
};

// Three buttons
export const ThreeButtons: Story = {
  args: {
    saveState: 'idle',
    children: (
      <>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button variant="secondary" size="sm" className="flex-1">
          Draft
        </Button>
        <Button size="sm" className="flex-1">
          Publish
        </Button>
      </>
    ),
  },
};

// With custom styling
export const CustomStyling: Story = {
  args: {
    saveState: 'idle',
    containerClassName: 'bg-primary/5',
    children: (
      <>
        <Button variant="ghost" className="flex-1">
          Cancel
        </Button>
        <Button variant="default" className="flex-1">
          Confirm
        </Button>
      </>
    ),
  },
};

// Interactive demo with state cycling
export const InteractiveDemo: Story = {
  args: {
    saveState: 'idle',
    children: null,
  },
  render: () => {
    const states: SaveState[] = ['idle', 'saving', 'saved', 'error'];
    const [currentState, setCurrentState] = React.useState<SaveState>('idle');
    const [stateIndex, setStateIndex] = React.useState(0);

    React.useEffect(() => {
      setCurrentState(states[stateIndex]);
    }, [stateIndex]);

    const cycleState = () => {
      setStateIndex((prev) => (prev + 1) % states.length);
    };

    return (
      <div className="h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-lg font-semibold">Click the button to cycle through states</p>
            <p className="text-sm text-muted-foreground">Current state: {currentState}</p>
            <Button onClick={cycleState}>
              Cycle State
            </Button>
          </div>
        </div>
        <BottomActionBar saveState={currentState}>
          <Button variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button className="flex-1" onClick={cycleState}>
            Save
          </Button>
        </BottomActionBar>
      </div>
    );
  },
};
