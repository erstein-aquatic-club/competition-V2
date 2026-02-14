import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ScaleSelector5 } from './ScaleSelector5';

const meta = {
  title: 'Shared/ScaleSelector5',
  component: ScaleSelector5,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'number', min: 1, max: 5, step: 1 },
      description: 'Currently selected value (1-5)',
    },
    onChange: {
      action: 'changed',
      description: 'Callback fired when a value is selected',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the selector is disabled',
    },
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md'],
      description: 'Size of the selector buttons',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessibility label for the selector group',
    },
  },
} satisfies Meta<typeof ScaleSelector5>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default state
export const Default: Story = {
  args: {
    value: null,
    disabled: false,
    size: 'md',
  },
};

// With selected value
export const WithValue: Story = {
  args: {
    value: 3,
    disabled: false,
    size: 'md',
  },
};

// Small size
export const SmallSize: Story = {
  args: {
    value: 4,
    disabled: false,
    size: 'sm',
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    value: 2,
    disabled: true,
    size: 'md',
  },
};

// Interactive example with state
export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState<number | null>(null);
    return (
      <div className="space-y-4">
        <ScaleSelector5 value={value} onChange={setValue} />
        <p className="text-sm text-muted-foreground">
          Selected value: {value ?? 'None'}
        </p>
      </div>
    );
  },
};

// All variations side by side
export const AllVariations: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">No selection</p>
        <ScaleSelector5 value={null} onChange={() => {}} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Value 1 (easiest)</p>
        <ScaleSelector5 value={1} onChange={() => {}} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Value 3 (medium)</p>
        <ScaleSelector5 value={3} onChange={() => {}} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Value 5 (hardest)</p>
        <ScaleSelector5 value={5} onChange={() => {}} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Small size</p>
        <ScaleSelector5 value={4} onChange={() => {}} size="sm" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Disabled</p>
        <ScaleSelector5 value={2} onChange={() => {}} disabled />
      </div>
    </div>
  ),
};
