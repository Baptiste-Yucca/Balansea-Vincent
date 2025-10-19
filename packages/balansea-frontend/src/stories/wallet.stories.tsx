import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';

import { Wallet } from '@/components/wallet';

const meta = {
  title: 'Components/Wallet',
  component: Wallet,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    ethAddress: { control: 'text' },
  },
} satisfies Meta<typeof Wallet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ethAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  },

  play: async ({ canvasElement, parameters }) => {
    const canvas = within(canvasElement);

    const ethAddress = parameters.ethAddress;
    const explorerButton = canvas.getByText(ethAddress, { selector: 'a' });
    await expect(explorerButton).toBeInTheDocument();

    const refreshBalanceButton = canvas.getByText('Refreshing...', { selector: 'button' });
    await expect(refreshBalanceButton).toBeInTheDocument();
  },
};
