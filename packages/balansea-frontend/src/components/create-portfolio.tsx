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

export const CreatePortfolio: React.FC<CreatePortfolioProps> = ({ onCreate }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState<boolean>(true);

  // Form state
  const [name, setName] = useState<string>('Mon Portfolio Crypto');
  const [allocations, setAllocations] = useState<AllocationConfig[]>([
    { assetSymbol: 'WBTC', targetPercentage: 0.5 },
    { assetSymbol: 'WETH', targetPercentage: 0.3 },
    { assetSymbol: 'USDC', targetPercentage: 0.2 },
  ]);
  const [rebalanceThreshold, setRebalanceThreshold] = useState<number>(0.05);
  const [monitoringFrequency, setMonitoringFrequency] = useState<string>('1h');

  const { getAssets, createPortfolio } = useBackend();

  // Charger les assets disponibles
  useEffect(() => {
    const loadAssets = async () => {
      try {
        setAssetsLoading(true);
        const availableAssets = await getAssets();
        setAssets(availableAssets);
      } catch (error) {
        console.error('Error loading assets:', error);
      } finally {
        setAssetsLoading(false);
      }
    };

    loadAssets();
  }, [getAssets]);

  const handleCreatePortfolio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      alert('Veuillez entrer un nom pour votre portfolio');
      return;
    }

    const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.targetPercentage, 0);
    if (Math.abs(totalPercentage - 1) > 0.001) {
      alert('Le total des allocations doit être exactement 100%');
      return;
    }

    try {
      setLoading(true);
      await createPortfolio({
        name: name.trim(),
        allocations,
        rebalanceThreshold,
        monitoringFrequency,
      });
      onCreate?.();
    } catch (error) {
      console.error('Error creating portfolio:', error);
      alert('Erreur lors de la création du portfolio');
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
            Créez un portfolio équilibré avec plusieurs cryptomonnaies. Le système rééquilibrera
            automatiquement selon vos allocations cibles.
            <br />
            <br />
            <strong>Comment ça marche :</strong>
            <br />
            • Définissez vos allocations cibles (ex: 50% WBTC, 30% WETH, 20% USDC)
            <br />
            • Le système surveille les prix et détecte les déviations
            <br />
            • Quand la déviation dépasse votre seuil, des swaps automatiques sont exécutés
            <br />• Votre portfolio reste toujours équilibré selon vos préférences
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Nom du portfolio */}
          <div className="space-y-2">
            <Label htmlFor="portfolio-name">Nom du Portfolio</Label>
            <Input
              id="portfolio-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mon Portfolio Crypto"
              required
            />
          </div>

          {/* Configuration des allocations */}
          <AllocationConfigComponent
            allocations={allocations}
            availableAssets={assets}
            onChange={setAllocations}
          />

          {/* Paramètres de rééquilibrage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rebalance-threshold">Seuil de Rééquilibrage</Label>
              <Select
                value={rebalanceThreshold.toString()}
                onValueChange={(value) => setRebalanceThreshold(parseFloat(value))}
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
                Le rééquilibrage se déclenche quand la déviation dépasse ce seuil
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monitoring-frequency">Fréquence de Surveillance</Label>
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
              <p className="text-xs text-gray-500">
                Fréquence de vérification des prix et des allocations
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button type="submit" disabled={loading} className="w-full md:w-auto px-8">
            {loading ? 'Création...' : 'Créer le Portfolio'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
