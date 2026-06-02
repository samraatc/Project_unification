import type { Meta, StoryObj } from '@storybook/react';

import { NeuCard } from './NeuCard.js';

const meta: Meta<typeof NeuCard> = {
  title: 'Surfaces/NeuCard',
  component: NeuCard,
  tags: ['autodocs'],
  parameters: {
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
  },
};

export default meta;
type Story = StoryObj<typeof NeuCard>;

export const Raised: Story = {
  args: {
    children: (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Raised Neumorphic surface</h3>
        <p className="text-sm text-text-secondary">
          Soft dual-shadow elevation. Hover lifts the card 2px (Design-System.md §3.1).
        </p>
      </div>
    ),
  },
};

export const Sunken: Story = {
  args: {
    sunken: true,
    children: (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Sunken (pressed) surface</h3>
        <p className="text-sm text-text-secondary">
          Inset shadow signals an input region or pressed state.
        </p>
      </div>
    ),
  },
};

export const Dense: Story = {
  args: {
    dense: true,
    children: (
      <p className="text-sm">
        Dense variant uses p-4 instead of p-6 for crowded mobile layouts.
      </p>
    ),
  },
};
