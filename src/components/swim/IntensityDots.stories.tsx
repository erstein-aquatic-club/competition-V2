import type { Meta, StoryObj } from '@storybook/react';
import { IntensityDots, intensityScale } from './IntensityDots';

const meta = {
  title: 'Swim/IntensityDots',
  component: IntensityDots,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'select' },
      options: intensityScale,
      description: 'Intensity level (V0, V1, V2, V3, Max)',
    },
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md'],
      description: 'Size of the dots',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof IntensityDots>;

export default meta;
type Story = StoryObj<typeof meta>;

// V0 - Easiest
export const V0: Story = {
  args: {
    value: 'V0',
    size: 'md',
  },
};

// V1
export const V1: Story = {
  args: {
    value: 'V1',
    size: 'md',
  },
};

// V2 - Medium
export const V2: Story = {
  args: {
    value: 'V2',
    size: 'md',
  },
};

// V3
export const V3: Story = {
  args: {
    value: 'V3',
    size: 'md',
  },
};

// Max - Hardest
export const Max: Story = {
  args: {
    value: 'Max',
    size: 'md',
  },
};

// Small size
export const SmallSize: Story = {
  args: {
    value: 'V2',
    size: 'sm',
  },
};

// All intensity levels
export const AllLevels: Story = {
  args: { value: 'V0' },
  render: () => (
    <div className="space-y-4">
      {intensityScale.map((level) => (
        <div key={level} className="flex items-center gap-4">
          <IntensityDots value={level} />
          <span className="text-sm text-muted-foreground w-24">
            {level === 'V0' && 'Easiest'}
            {level === 'V1' && 'Easy'}
            {level === 'V2' && 'Medium'}
            {level === 'V3' && 'Hard'}
            {level === 'Max' && 'Hardest'}
          </span>
        </div>
      ))}
    </div>
  ),
};

// Size comparison
export const SizeComparison: Story = {
  args: { value: 'V3' },
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">Medium size (default)</p>
        <IntensityDots value="V3" size="md" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Small size</p>
        <IntensityDots value="V3" size="sm" />
      </div>
    </div>
  ),
};

// In a card context
export const InCard: Story = {
  args: { value: 'V2' },
  render: () => (
    <div className="w-80 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Workout Session</h3>
        <IntensityDots value="V2" size="sm" />
      </div>
      <p className="text-sm text-muted-foreground">
        800m warm-up, 10x100m intervals, 200m cool-down
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>45 minutes</span>
        <IntensityDots value="V3" size="sm" />
      </div>
    </div>
  ),
};

// List of workouts with different intensities
export const WorkoutList: Story = {
  args: { value: 'V1' },
  render: () => (
    <div className="w-96 space-y-2">
      {[
        { name: 'Recovery Swim', intensity: 'V0' as const, duration: '30 min' },
        { name: 'Endurance Training', intensity: 'V1' as const, duration: '60 min' },
        { name: 'Threshold Work', intensity: 'V2' as const, duration: '45 min' },
        { name: 'Speed Intervals', intensity: 'V3' as const, duration: '40 min' },
        { name: 'Sprint Race Pace', intensity: 'Max' as const, duration: '30 min' },
      ].map((workout, index) => (
        <div
          key={index}
          className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors"
        >
          <div>
            <p className="text-sm font-medium">{workout.name}</p>
            <p className="text-xs text-muted-foreground">{workout.duration}</p>
          </div>
          <IntensityDots value={workout.intensity} size="sm" />
        </div>
      ))}
    </div>
  ),
};

// Color progression showcase
export const ColorProgression: Story = {
  args: { value: 'V0' },
  render: () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <p className="text-sm font-medium mb-2">Intensity Color Scale</p>
        <p className="text-xs text-muted-foreground">
          Green (easy) → Yellow (medium) → Red (hard)
        </p>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {intensityScale.map((level) => (
          <div key={level} className="text-center space-y-2">
            <IntensityDots value={level} />
          </div>
        ))}
      </div>
    </div>
  ),
};
