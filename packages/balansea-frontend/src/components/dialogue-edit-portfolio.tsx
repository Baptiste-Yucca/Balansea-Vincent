import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

import { useBackend, Portfolio, Asset, AllocationConfig } from '@/hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export interface EditPortfolioDialogProps {
  portfolio: Portfolio;
  onClose: () => void;
  onUpdate: () => void;
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

export const DialogueEditPortfolio: React.FC<EditPortfolioDialogProps> = ({
  portfolio,
  onClose,
  onUpdate,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState<boolean>(true);

  // Form state
  const [name, setName] = useState<string>(portfolio.name);
  const [allocations, setAllocations] = useState<AllocationConfig[]>([]);
  const [rebalanceThreshold, setRebalanceThreshold] = useState<number>(
    portfolio.rebalanceThreshold
  );
  const [monitoringFrequency, setMonitoringFrequency] = useState<string>(
    portfolio.monitoringFrequency
  );

  const { getAssets, updateAllocations, updatePortfolioSettings } = useBackend();

  // Initialiser les allocations depuis le portfolio
  useEffect(() => {
    const portfolioAllocations = portfolio.allocations.map((alloc) => ({
      assetSymbol: alloc.asset.symbol,
      targetPercentage: alloc.targetPercentage,
    }));
    setAllocations(portfolioAllocations);
  }, [portfolio]);

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

  const handleUpdateAllocations = async () => {
    const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.targetPercentage, 0);
    if (Math.abs(totalPercentage - 1) > 0.001) {
      alert('Le total des allocations doit être exactement 100%');
      return;
    }

    try {
      setLoading(true);
      await updateAllocations(portfolio._id, { allocations });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating allocations:', error);
      alert('Erreur lors de la mise à jour des allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      setLoading(true);
      await updatePortfolioSettings(portfolio._id, {
        name: name.trim(),
        rebalanceThreshold,
        monitoringFrequency,
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Erreur lors de la mise à jour des paramètres');
    } finally {
      setLoading(false);
    }
  };

  if (assetsLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-6">
            <Spinner />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Modifier le Portfolio</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Paramètres généraux */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Paramètres Généraux</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom du Portfolio</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mon Portfolio Crypto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-threshold">Seuil de Rééquilibrage</Label>
                <Select
                  value={rebalanceThreshold.toString()}
                  onValueChange={(value) => setRebalanceThreshold(parseFloat(value))}
                >
                  <SelectTrigger id="edit-threshold">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-frequency">Fréquence de Surveillance</Label>
                <Select value={monitoringFrequency} onValueChange={setMonitoringFrequency}>
                  <SelectTrigger id="edit-frequency">
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
              </div>
            </div>

            <Button onClick={handleUpdateSettings} disabled={loading}>
              {loading ? 'Mise à jour...' : 'Mettre à jour les Paramètres'}
            </Button>
          </div>

          {/* Configuration des allocations */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Allocations</h3>

            <AllocationConfigComponent
              allocations={allocations}
              availableAssets={assets}
              onChange={setAllocations}
            />

            <Button onClick={handleUpdateAllocations} disabled={loading}>
              {loading ? 'Mise à jour...' : 'Mettre à jour les Allocations'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
