# Balansea API Documentation

## 🎯 Vue d'ensemble

L'API Balansea permet de gérer des portfolios multi-assets avec rééquilibrage automatique.

## 🔐 Authentification

Toutes les routes nécessitent un JWT Vincent valide dans l'en-tête `Authorization: Bearer <jwt>`.

## 📊 Assets

### GET /assets

Récupère tous les assets actifs.

**Response:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "symbol": "USDC",
      "name": "USD Coin",
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "decimals": 6,
      "chainId": 8453,
      "isActive": true,
      "pythPriceId": "...",
      "logoUrl": "...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "success": true
}
```

### GET /assets/:assetSymbol

Récupère un asset spécifique.

**Parameters:**

- `assetSymbol` (string): Symbole de l'asset (ex: "USDC")

### POST /assets

Ajoute un nouvel asset.

**Body:**

```json
{
  "symbol": "AAVE",
  "name": "Aave Token",
  "address": "0x...",
  "decimals": 18,
  "chainId": 8453,
  "pythPriceId": "...",
  "logoUrl": "..."
}
```

### DELETE /assets/:assetSymbol

Désactive un asset.

## 💼 Portfolios

### GET /portfolios

Récupère tous les portfolios de l'utilisateur.

**Response:**

```json
{
  "data": [
    {
      "_id": "64f...",
      "ethAddress": "0x...",
      "name": "Mon Portfolio Crypto",
      "isActive": true,
      "rebalanceThreshold": 0.05,
      "monitoringFrequency": "1h",
      "totalValueUSD": 1000,
      "allocations": [
        {
          "_id": "64f...",
          "targetPercentage": 0.5,
          "currentPercentage": 0.48,
          "currentValueUSD": 480,
          "asset": {
            "symbol": "WBTC",
            "name": "Wrapped Bitcoin",
            "address": "0x...",
            "decimals": 8
          }
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "success": true
}
```

### POST /portfolios

Crée un nouveau portfolio.

**Body:**

```json
{
  "name": "Mon Portfolio Crypto",
  "allocations": [
    {
      "assetSymbol": "WBTC",
      "targetPercentage": 0.5
    },
    {
      "assetSymbol": "WETH",
      "targetPercentage": 0.3
    },
    {
      "assetSymbol": "USDC",
      "targetPercentage": 0.2
    }
  ],
  "rebalanceThreshold": 0.05,
  "monitoringFrequency": "1h"
}
```

### GET /portfolios/:portfolioId

Récupère un portfolio spécifique avec ses allocations.

### PUT /portfolios/:portfolioId/allocations

Met à jour les allocations d'un portfolio.

**Body:**

```json
{
  "allocations": [
    {
      "assetSymbol": "WBTC",
      "targetPercentage": 0.6
    },
    {
      "assetSymbol": "WETH",
      "targetPercentage": 0.4
    }
  ]
}
```

### PUT /portfolios/:portfolioId/settings

Met à jour les paramètres d'un portfolio.

**Body:**

```json
{
  "rebalanceThreshold": 0.03,
  "monitoringFrequency": "30m"
}
```

### DELETE /portfolios/:portfolioId

Désactive un portfolio.

## 🚨 Codes d'erreur

- `400` - Bad Request (données invalides)
- `403` - Forbidden (accès refusé)
- `404` - Not Found (ressource introuvable)
- `500` - Internal Server Error (erreur serveur)

## 📝 Exemples d'utilisation

### Créer un portfolio 60/40 WBTC/WETH

```bash
curl -X POST http://localhost:3001/portfolios \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Portfolio Bitcoin/Ethereum",
    "allocations": [
      {"assetSymbol": "WBTC", "targetPercentage": 0.6},
      {"assetSymbol": "WETH", "targetPercentage": 0.4}
    ],
    "rebalanceThreshold": 0.05,
    "monitoringFrequency": "1h"
  }'
```

### Récupérer tous les portfolios

```bash
curl -X GET http://localhost:3001/portfolios \
  -H "Authorization: Bearer <jwt>"
```
