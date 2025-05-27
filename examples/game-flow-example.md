# Ejemplo de Flujo Completo de Partidas y Transacciones

Este documento muestra cómo usar las nuevas funcionalidades implementadas para manejar partidas con transferencias automáticas de créditos y sistema de transacciones.

## 🚀 Flujo Completo de una Partida

### 1. Iniciar una Partida

```bash
# Iniciar partida multijugador entre dos usuarios
curl -X POST http://localhost:3000/games/start \
  -H "Content-Type: application/json" \
  -d '{
    "playerTelegramId": 123456789,
    "opponentTelegramId": 987654321,
    "gameType": "multiplayer",
    "gameId": "tap-reaction",
    "creditsWagered": 50,
    "isRanked": true
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6789012345a",
    "playerId": "64a1b2c3d4e5f6789012345b",
    "playerTelegramId": 123456789,
    "opponentId": "64a1b2c3d4e5f6789012345c",
    "opponentTelegramId": 987654321,
    "gameId": "tap-reaction",
    "status": "started",
    "creditsWagered": 50,
    "startedAt": "2024-01-15T10:00:00.000Z"
  },
  "message": "Partida iniciada exitosamente"
}
```

### 2. Finalizar una Partida

```bash
# Finalizar partida con ganador
curl -X PUT http://localhost:3000/games/finish \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "64a1b2c3d4e5f6789012345a",
    "status": "completed",
    "playerScore": 150,
    "opponentScore": 120,
    "gameData": {
      "moves": 15,
      "timeLeft": 30
    },
    "notes": "Partida muy reñida"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6789012345a",
    "status": "completed",
    "playerScore": 150,
    "opponentScore": 120,
    "creditsWon": 100,
    "duration": 120,
    "endedAt": "2024-01-15T10:02:00.000Z"
  },
  "message": "Partida finalizada exitosamente"
}
```

### 3. Consultar Transacciones de un Usuario

```bash
# Obtener transacciones del ganador
curl "http://localhost:3000/transactions/user/123456789?limit=10&type=match"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "64a1b2c3d4e5f6789012345d",
        "type": "match",
        "itemType": "win",
        "amount": 100,
        "betAmount": 50,
        "winnings": 100,
        "gameTemplate": {
          "name": "Tap Reaction"
        },
        "date": "2024-01-15T10:02:00.000Z",
        "sortDate": "2024-01-15T10:02:00.000Z"
      }
    ],
    "stats": {
      "totalWins": 1,
      "totalLosses": 0,
      "netAmount": 100,
      "totalWinnings": 100
    },
    "user": {
      "telegramId": 123456789,
      "username": "player1",
      "currentBalance": 150
    }
  },
  "message": "Transacciones obtenidas exitosamente"
}
```

## 🎮 Casos de Uso Específicos

### Partida con Empate

```json
{
  "gameId": "64a1b2c3d4e5f6789012345a",
  "status": "draw",
  "playerScore": 100,
  "opponentScore": 100
}
```
*Resultado: Los créditos apostados se devuelven a ambos jugadores*

### Partida Abandonada

```json
{
  "gameId": "64a1b2c3d4e5f6789012345a",
  "status": "abandoned"
}
```
*Resultado: Los créditos apostados se devuelven a ambos jugadores*

### Partida Individual

```json
{
  "playerTelegramId": 123456789,
  "gameType": "single_player",
  "gameId": "memory-cards",
  "creditsWagered": 25
}
```
*Resultado: Solo se descuentan créditos al jugador, no hay oponente*

## 💰 Gestión de Transacciones

### Registrar Compra de Créditos

```bash
curl -X POST http://localhost:3000/transactions/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userTelegramId": 123456789,
    "amount": 500,
    "description": "Compra de 500 créditos",
    "metadata": {
      "paymentMethod": "card",
      "transactionId": "txn_12345"
    }
  }'
```

### Registrar Reembolso

```bash
curl -X POST http://localhost:3000/transactions/refund \
  -H "Content-Type: application/json" \
  -d '{
    "userTelegramId": 123456789,
    "amount": 50,
    "description": "Reembolso por partida cancelada",
    "relatedGameId": "64a1b2c3d4e5f6789012345a"
  }'
```

## 📊 Estadísticas y Reportes

### Estadísticas Globales del Sistema

```bash
curl "http://localhost:3000/games/stats/global"
```

### Historial entre Dos Usuarios

```bash
curl "http://localhost:3000/games/between/123456789/987654321?limit=5"
```

### Estadísticas de Transacciones de Usuario

```bash
curl "http://localhost:3000/transactions/stats/123456789"
```

## 🔄 Flujo Automático de Transferencias

### Cuando se inicia una partida:
1. ✅ Se validan los créditos suficientes de ambos jugadores
2. ✅ Se descuentan los créditos apostados de ambos jugadores
3. ✅ Se crea el registro del juego con estado "started"

### Cuando se finaliza una partida:
1. ✅ Se determina el ganador (por puntuación o estado explícito)
2. ✅ Se transfieren todos los créditos apostados al ganador
3. ✅ Se registran las transacciones correspondientes para ambos jugadores
4. ✅ Se actualizan las estadísticas de los usuarios
5. ✅ En caso de empate: se devuelven los créditos a ambos jugadores

## 🛡️ Consistencia de Datos

- **Transacciones Atómicas**: Todas las operaciones se realizan dentro de transacciones de MongoDB
- **Rollback Automático**: Si algo falla, todos los cambios se revierten automáticamente
- **Validaciones**: Se validan créditos suficientes antes de iniciar partidas
- **Auditoria**: Todas las transferencias quedan registradas en la tabla de transacciones

## 📋 Formatos de Respuesta para Frontend

### Formato de Transacción
```typescript
interface Transaction {
  id: string;
  type: 'match' | 'transaction';
  itemType: 'win' | 'loss' | 'draw' | 'income' | 'expense' | 'refund';
  gameTemplate?: { name: string }; // solo si aplica
  description?: string; // solo si aplica
  amount: number;
  betAmount?: number; // si aplica
  winnings?: number; // si aplica
  winnerId?: string; // si aplica
  date: string;
  sortDate: Date;
}
```

### Filtros Disponibles
- `type`: 'match' | 'transaction'
- `itemType`: 'win' | 'loss' | 'draw' | 'income' | 'expense' | 'refund'
- `dateFrom` / `dateTo`: fechas en formato ISO
- `limit` / `offset`: paginación (máximo 100 por consulta)

¡Ya tienes un sistema completo de partidas con transferencias automáticas y auditoría de transacciones! 🎉 