import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Asset } from '@/hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export interface AllocationConfig {
  assetSymbol: string;
  targetPercentage: number;
}

interface AllocationConfigProps {
  allocations: AllocationConfig[];
  availableAssets: Asset[];
  onChange: (allocations: AllocationConfig[]) => void;
  disabled?: boolean;
}

export const AllocationConfig: React.FC<AllocationConfigProps> = ({
  allocations,
  availableAssets,
  onChange,
  disabled = false,
}) => {
  const [localAllocations, setLocalAllocations] = useState<AllocationConfig[]>(allocations);

  useEffect(() => {
    setLocalAllocations(allocations);
  }, [allocations]);

  // Debug: Log des assets disponibles
  useEffect(() => {
    console.log('📋 Assets disponibles dans AllocationConfig:', availableAssets);
  }, [availableAssets]);

  const updateAllocation = (index: number, updates: Partial<AllocationConfig>) => {
    const newAllocations = [...localAllocations];
    newAllocations[index] = { ...newAllocations[index], ...updates };
    setLocalAllocations(newAllocations);
    onChange(newAllocations);
  };

  const addAllocation = () => {
    const usedSymbols = localAllocations.map((a) => a.assetSymbol);
    const availableAsset = availableAssets.find((asset) => !usedSymbols.includes(asset.symbol));

    if (availableAsset) {
      const newAllocations = [
        ...localAllocations,
        { assetSymbol: availableAsset.symbol, targetPercentage: 0 },
      ];
      setLocalAllocations(newAllocations);
      onChange(newAllocations);
    }
  };

  const removeAllocation = (index: number) => {
    const newAllocations = localAllocations.filter((_, i) => i !== index);
    setLocalAllocations(newAllocations);
    onChange(newAllocations);
  };

  const getAvailableAssets = (currentIndex: number) => {
    const usedSymbols = localAllocations
      .filter((_, index) => index !== currentIndex)
      .map((a) => a.assetSymbol);

    return availableAssets.filter((asset) => !usedSymbols.includes(asset.symbol));
  };

  const getTotalPercentage = () => {
    return localAllocations.reduce((sum, alloc) => sum + alloc.targetPercentage, 0);
  };

  const getRemainingPercentage = () => {
    return Math.max(0, 1 - getTotalPercentage());
  };

  const isTotalValid = () => {
    return Math.abs(getTotalPercentage() - 1) < 0.001; // Tolérance de 0.1%
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Allocations configuration</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isTotalValid() ? 'text-green-600' : 'text-red-600'}`}>
              Total percentage: {(getTotalPercentage() * 100).toFixed(1)}%
            </span>
            {!isTotalValid() && (
              <span className="text-xs text-red-500">
                (Remaining: {(getRemainingPercentage() * 100).toFixed(1)}%)
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {localAllocations.map((allocation, index) => (
          <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="flex-1">
              <Label htmlFor={`asset-${index}`} className="text-sm font-medium">
                Asset
              </Label>
              <Select
                value={allocation.assetSymbol}
                onValueChange={(value) => updateAllocation(index, { assetSymbol: value })}
                disabled={disabled}
              >
                <SelectTrigger id={`asset-${index}`}>
                  <SelectValue placeholder="Sélectionner un asset" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableAssets(index).map((asset) => (
                    <SelectItem key={asset._id} value={asset.symbol}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{asset.symbol}</span>
                        <span className="text-sm text-gray-500">- {asset.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label htmlFor={`percentage-${index}`} className="text-sm font-medium">
                Pourcentage: {(allocation.targetPercentage * 100).toFixed(1)}%
              </Label>
              <Slider
                value={[allocation.targetPercentage * 100]}
                onValueChange={([value]) =>
                  updateAllocation(index, {
                    targetPercentage: value / 100,
                  })
                }
                max={100}
                step={0.1}
                disabled={disabled}
                className="mt-2"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => removeAllocation(index)}
              disabled={disabled || localAllocations.length <= 1}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {getAvailableAssets(-1).length > 0 && (
          <Button variant="outline" onClick={addAllocation} disabled={disabled} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un Asset
          </Button>
        )}

        {!isTotalValid() && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              ⚠️ Le total des allocations doit être exactement 100%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
