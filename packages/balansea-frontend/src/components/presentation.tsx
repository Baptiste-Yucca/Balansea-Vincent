import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Info } from '@/components/info';
import { useBackend } from '@/hooks/useBackend';

export const Presentation: React.FC = () => {
  const { getJwt } = useBackend();

  return (
    <Card data-testid="presentation" className="w-full md:max-w-md bg-white p-8 shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">BalanSea</CardTitle>
        <CardDescription className="text-gray-600">
          Automated assets' Balance & Rebalance
        </CardDescription>
      </CardHeader>

      <Separator className="my-4" />

      <CardContent className="text-center">
        <p className="text-gray-700">
          Welcome to the Vincent DCA Service. This application allows you to set up automated
          dollar-cost-averaging for your wBtc investments on Base.
        </p>
        <p className="mt-4 text-gray-700">Support for more chains coming soon.</p>
        <p className="mt-4 text-gray-700">
          To get started, please Connect with Vincent to manage your DCA schedules.
        </p>
      </CardContent>

      <CardFooter className="flex flex-col items-center">
        <Button onClick={getJwt} className="bg-purple-600 text-white hover:bg-purple-700">
          Connect with Vincent
        </Button>
        <Info />
      </CardFooter>
    </Card>
  );
};
