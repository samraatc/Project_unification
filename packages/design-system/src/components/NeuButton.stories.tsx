import type { Meta, StoryObj } from '@storybook/react';

import { NeuButton } from './NeuButton.js';

const meta: Meta<typeof NeuButton> = {
  title: 'Controls/NeuButton',
  component: NeuButton,
  tags: ['autodocs'],
  args: { children: 'Continue' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof NeuButton>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Delete' } };
export const Loading: Story = { args: { loading: true, children: 'Saving…' } };

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <NeuButton size="sm">Small</NeuButton>
      <NeuButton size="md">Medium</NeuButton>
      <NeuButton size="lg">Large</NeuButton>
    </div>
  ),
};
