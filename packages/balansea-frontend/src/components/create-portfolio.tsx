import React, { useState, useEffect, FormEvent } from 'react';

import { useBackend, Asset, AllocationConfig } from '@/hooks/useBackend';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AllocationConfig as AllocationConfigComponent } from '@/components/allocation-config';
import { Spinner } from '@/components/ui/spinner';

export interface CreatePortfolioProps {
  onCreate?: () => void;
}

const MONITORING_FREQUENCIES = [
  { value: '10s', label: '10 secondes' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 heure' },
  { value: '4h', label: '4 heures' },
  { value: '1d', label: '1 jour' },
];

const REBALANCE_THRESHOLDS = [
  { value: 0.01, label: '1%' },
  { value: 0.02, label: '2%' },
  { value: 0.03, label: '3%' },
  { value: 0.05, label: '5%' },
  { value: 0.1, label: '10%' },
];

const REBALANCE_TYPES = [
  {
    value: 'threshold',
    label: 'Tolerance threshold',
    description: 'Rebalance only if the deviation exceeds the defined threshold',
  },
  {
    value: 'strict_periodic',
    label: 'Strict periodic',
    description: 'Rebalance always towards the exact allocations at each cycle',
  },
];

export const CreatePortfolio: React.FC<CreatePortfolioProps> = ({ onCreate }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState<boolean>(true);

  // Form state
  const [name, setName] = useState<string>('My Portfolio Crypto');
  const [allocations, setAllocations] = useState<AllocationConfig[]>([
    { assetSymbol: 'WBTC', targetPercentage: 0.5 },
    { assetSymbol: 'WETH', targetPercentage: 0.3 },
    { assetSymbol: 'USDC', targetPercentage: 0.2 },
  ]);
  const [rebalanceThreshold, setRebalanceThreshold] = useState<number>(0.05);
  const [monitoringFrequency, setMonitoringFrequency] = useState<string>('1h');
  const [rebalanceType, setRebalanceType] = useState<string>('threshold');

  const { getAssets, createPortfolio } = useBackend();

  // Load available assets
  useEffect(() => {
    const loadAssets = async () => {
      try {
        setAssetsLoading(true);
        const availableAssets = await getAssets();
        console.log('✅ Assets chargés:', availableAssets);
        setAssets(availableAssets);
      } catch (error) {
        console.error('❌ Error loading assets:', error);
        alert('Error loading available assets');
      } finally {
        setAssetsLoading(false);
      }
    };

    loadAssets();
  }, [getAssets]);

  const handleCreatePortfolio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      alert('Please enter a name for your portfolio');
      return;
    }

    const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.targetPercentage, 0);
    if (Math.abs(totalPercentage - 1) > 0.001) {
      alert('The total of allocations must be exactly 100%');
      return;
    }

    try {
      setLoading(true);
      await createPortfolio({
        name: name.trim(),
        allocations,
        rebalanceThreshold,
        monitoringFrequency,
        rebalanceType,
      });
      onCreate?.();
    } catch (error) {
      console.error('Error creating portfolio:', error);
      alert('Error creating portfolio');
    } finally {
      setLoading(false);
    }
  };

  if (assetsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col justify-between bg-white p-6 shadow-sm">
      <form onSubmit={handleCreatePortfolio}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Portfolio Multi-Assets</CardTitle>
          <CardDescription className="mt-2 text-gray-600">
            Create a balanced portfolio with multiple cryptocurrencies. The system will rebalance
            automatically according to your target allocations.
            <br />
            <br />
            <strong>Two rebalancing modes:</strong>
            <br />• <strong>Tolerance threshold</strong> : Rebalance only if the deviation exceeds
            the defined threshold
            <br />• <strong>Strict periodic</strong> : Rebalance always towards the exact
            allocations at each cycle
            <br />
            <br />
            <strong>How it works:</strong>
            <br />
            • Set your target allocations (e.g. 50% WBTC, 30% WETH, 20% USDC)
            <br />
            • The system monitors the prices and detects deviations
            <br />
            • Automatic swaps are executed according to your chosen mode
            <br />• Your portfolio remains balanced according to your preferences
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Nom du portfolio */}
          <div className="space-y-2">
            <Label htmlFor="portfolio-name">Portfolio Name</Label>
            <Input
              id="portfolio-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Portfolio Crypto"
              required
            />
          </div>

          {/* Configuration des allocations */}
          <AllocationConfigComponent
            allocations={allocations}
            availableAssets={assets}
            onChange={setAllocations}
          />

          {/* Type de rééquilibrage */}
          <div className="space-y-2">
            <Label htmlFor="rebalance-type">Rebalancing Type</Label>
            <Select value={rebalanceType} onValueChange={setRebalanceType}>
              <SelectTrigger id="rebalance-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REBALANCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paramètres de rééquilibrage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rebalance-threshold">Rebalancing Threshold</Label>
              <Select
                value={rebalanceThreshold.toString()}
                onValueChange={(value) => setRebalanceThreshold(parseFloat(value))}
                disabled={rebalanceType === 'strict_periodic'}
              >
                <SelectTrigger id="rebalance-threshold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REBALANCE_THRESHOLDS.map((threshold) => (
                    <SelectItem key={threshold.value} value={threshold.value.toString()}>
                      {threshold.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {rebalanceType === 'strict_periodic'
                  ? 'Not applicable in strict periodic mode'
                  : 'Rebalancing is triggered when the deviation exceeds this threshold'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monitoring-frequency">Monitoring Frequency</Label>
              <Select value={monitoringFrequency} onValueChange={setMonitoringFrequency}>
                <SelectTrigger id="monitoring-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONITORING_FREQUENCIES.map((freq) => (
                    <SelectItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Frequency of checking prices and allocations</p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button type="submit" disabled={loading} className="w-full md:w-auto px-8">
            {loading ? 'Creation...' : 'Create the Portfolio'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
