/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the Phase 0 primitives. Storybook + axe-playwright cover
 * the accessibility regression net in CI.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NeuButton } from '../NeuButton.js';
import { NeuCard } from '../NeuCard.js';
import { NeuInput } from '../NeuInput.js';

describe('NeuCard', () => {
  it('renders children', () => {
    render(<NeuCard>Hello</NeuCard>);
    expect(screen.getByText('Hello')).toBeTruthy();
  });
});

describe('NeuButton', () => {
  it('renders an accessible button', () => {
    render(<NeuButton>Continue</NeuButton>);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('exposes aria-busy when loading', () => {
    render(<NeuButton loading>Saving</NeuButton>);
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');
  });
});

describe('NeuInput', () => {
  it('associates label and input', () => {
    render(<NeuInput label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeTruthy();
  });

  it('marks invalid state when error present', () => {
    render(<NeuInput label="Email" error="Required" />);
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Required');
  });
});
