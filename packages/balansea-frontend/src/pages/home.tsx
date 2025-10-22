import React, { useState } from 'react';

import { CreatePortfolio } from '@/components/create-portfolio';
import { ActivePortfolios } from '@/components/active-portfolios';
import { Wallet } from '@/components/wallet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

enum Tab {
  CreatePortfolio = 'create-portfolio',
  ActivePortfolios = 'active-portfolios',
  MyWallet = 'my-wallet',
}

export const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CreatePortfolio);

  const handlePortfolioCreated = () => {
    setActiveTab(Tab.ActivePortfolios);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Balansea</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Set your target allocations
            <br />
            And let BalanSea keep them balanced
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as Tab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value={Tab.CreatePortfolio}>Create a Portfolio</TabsTrigger>
            <TabsTrigger value={Tab.ActivePortfolios}>My Portfolios</TabsTrigger>
            <TabsTrigger value={Tab.MyWallet}>My Wallet</TabsTrigger>
          </TabsList>

          <TabsContent value={Tab.CreatePortfolio}>
            <CreatePortfolio onCreate={handlePortfolioCreated} />
          </TabsContent>

          <TabsContent value={Tab.ActivePortfolios}>
            <ActivePortfolios />
          </TabsContent>

          <TabsContent value={Tab.MyWallet}>
            <Wallet />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
