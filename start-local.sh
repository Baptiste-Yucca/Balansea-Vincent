#!/bin/bash

echo "🚀 Démarrage du projet Balansea en local..."

# Vérifier que MongoDB est démarré
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB n'est pas démarré. Démarrage..."
    brew services start mongodb-community
    sleep 3
fi

# Vérifier que les fichiers .env existent
if [ ! -f ".env" ]; then
    echo "❌ Fichier .env manquant à la racine. Veuillez le créer."
    exit 1
fi

if [ ! -f "packages/balansea-backend/.env" ]; then
    echo "❌ Fichier packages/balansea-backend/.env manquant. Veuillez le créer."
    exit 1
fi

if [ ! -f "packages/balansea-frontend/.env" ]; then
    echo "❌ Fichier packages/balansea-frontend/.env manquant. Veuillez le créer."
    exit 1
fi

echo "✅ Configuration vérifiée. Lancement des services..."

# Lancer le backend et le frontend en parallèle
echo "🚀 Lancement du backend sur le port 3001..."
cd packages/balansea-backend && pnpm dev &
BACKEND_PID=$!

echo "🚀 Lancement du frontend sur le port 5176..."
cd ../balansea-frontend && pnpm dev --port 5176 &
FRONTEND_PID=$!

echo "✅ Services lancés !"
echo "📱 Frontend: http://localhost:5176"
echo "🔧 Backend: http://localhost:3001"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter tous les services"

# Attendre que les processus se terminent
wait $BACKEND_PID $FRONTEND_PID
