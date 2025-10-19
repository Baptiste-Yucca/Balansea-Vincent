import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Play, Pause, TrendingUp, DollarSign, Clock } from 'lucide-react';

import { useBackend, Portfolio } from '@/hooks/useBackend';
import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { DialogueEditPortfolio } from '@/components/dialogue-edit-portfolio';

export const ActivePortfolios: React.FC = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);

  const { getPortfolios, deactivatePortfolio, updatePortfolioSettings } = useBackend();

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      const data = await getPortfolios();
      setPortfolios(data);
    } catch (error) {
      console.error('Error loading portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolios();
  }, []);

  const handleTogglePortfolio = async (portfolio: Portfolio) => {
    try {
      await updatePortfolioSettings(portfolio._id, {
        isActive: !portfolio.isActive,
      });
      await loadPortfolios();
    } catch (error) {
      console.error('Error toggling portfolio:', error);
      alert('Erreur lors de la modification du portfolio');
    }
  };

  const handleDeletePortfolio = async (portfolio: Portfolio) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le portfolio "${portfolio.name}" ?`)) {
      return;
    }

    try {
      await deactivatePortfolio(portfolio._id);
      await loadPortfolios();
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      alert('Erreur lors de la suppression du portfolio');
    }
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatusBadge = (portfolio: Portfolio) => {
    if (portfolio.isActive) {
      return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
    }
    return <Badge variant="secondary">Inactif</Badge>;
  };

  const getDeviationColor = (allocation: any) => {
    const deviation = Math.abs(allocation.targetPercentage - allocation.currentPercentage);
    if (deviation > 0.1) return 'text-red-600';
    if (deviation > 0.05) return 'text-orange-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (portfolios.length === 0) {
    return (
      <Card>
        <CardContent className="text-center p-6">
          <div className="text-gray-500 mb-4">
            <TrendingUp className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-medium">Aucun portfolio actif</h3>
            <p>Créez votre premier portfolio pour commencer le rééquilibrage automatique</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Mes Portfolios</h2>
        <Button onClick={loadPortfolios} variant="outline">
          Actualiser
        </Button>
      </div>

      <div className="grid gap-6">
        {portfolios.map((portfolio) => (
          <Card key={portfolio._id} className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{portfolio.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(portfolio)}
                    <Badge variant="outline">
                      Seuil: {formatPercentage(portfolio.rebalanceThreshold)}
                    </Badge>
                    <Badge variant="outline">{portfolio.monitoringFrequency}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPortfolio(portfolio)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTogglePortfolio(portfolio)}
                  >
                    {portfolio.isActive ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePortfolio(portfolio)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold">{formatValue(portfolio.totalValueUSD)}</div>
                  <div className="text-sm text-gray-600">Valeur Totale</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">{portfolio.allocations.length}</div>
                  <div className="text-sm text-gray-600">Assets</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <div className="text-2xl font-bold">
                    {portfolio.lastRebalanceAt
                      ? new Date(portfolio.lastRebalanceAt).toLocaleDateString('fr-FR')
                      : 'Jamais'}
                  </div>
                  <div className="text-sm text-gray-600">Dernier Rééquilibrage</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Allocations</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Allocation Cible</TableHead>
                      <TableHead>Allocation Actuelle</TableHead>
                      <TableHead>Valeur USD</TableHead>
                      <TableHead>Déviation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.allocations.map((allocation) => {
                      const deviation = allocation.targetPercentage - allocation.currentPercentage;
                      return (
                        <TableRow key={allocation._id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{allocation.asset.symbol}</span>
                              <span className="text-sm text-gray-500">{allocation.asset.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {formatPercentage(allocation.targetPercentage)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={getDeviationColor(allocation)}>
                              {formatPercentage(allocation.currentPercentage)}
                            </span>
                          </TableCell>
                          <TableCell>{formatValue(allocation.currentValueUSD)}</TableCell>
                          <TableCell>
                            <span className={getDeviationColor(allocation)}>
                              {deviation > 0 ? '+' : ''}
                              {formatPercentage(Math.abs(deviation))}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingPortfolio && (
        <DialogueEditPortfolio
          portfolio={editingPortfolio}
          onClose={() => setEditingPortfolio(null)}
          onUpdate={loadPortfolios}
        />
      )}
    </Box>
  );
};
