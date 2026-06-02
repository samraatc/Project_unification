import type { Meta, StoryObj } from '@storybook/react';

import { NeuInput } from './NeuInput.js';

const meta: Meta<typeof NeuInput> = {
  title: 'Controls/NeuInput',
  component: NeuInput,
  tags: ['autodocs'],
  args: { placeholder: 'you@example.com' },
};

export default meta;
type Story = StoryObj<typeof NeuInput>;

export const Default: Story = { args: { label: 'Email', type: 'email' } };

export const WithHint: Story = {
  args: { label: 'Email', hint: 'We send the OTP here.', type: 'email' },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    error: 'Email is required.',
    'aria-invalid': true,
    defaultValue: '',
  },
};

export const Search: Story = {
  args: { label: 'Search products', type: 'search', placeholder: 'Try “running shoes”' },
};
