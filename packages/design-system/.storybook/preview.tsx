import type { Preview } from '@storybook/react';
import React from 'react';

import '../src/globals.css';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: {
      // Enforce WCAG 2.1 AA per TRD §5.
      config: { rules: [{ id: 'color-contrast', enabled: true }] },
      options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    },
    backgrounds: {
      default: 'surface',
      values: [
        { name: 'surface', value: '#E8ECF3' },
        { name: 'dark', value: '#1E2230' },
      ],
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme ?? 'light';
      return (
        <div data-theme={theme} className="min-h-screen p-8 bg-surface text-text-primary">
          <Story />
        </div>
      );
    },
  ],
  globalTypes: {
    theme: {
      name: 'Theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
