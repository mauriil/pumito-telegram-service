# Documentación de Endpoints API

Esta API proporciona endpoints para gestionar usuarios y juegos del bot de Telegram.

## Base URL
```
http://localhost:3000/api
```

## Endpoints de Usuarios

### 1. Obtener datos del usuario
**GET** `/api/users/{telegramId}`

Obtiene todos los datos enriquecidos de un usuario específico.

**Parámetros:**
- `telegramId` (number): ID de Telegram del usuario

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "telegramId": 123456789,
    "username": "usuario123",
    "firstName": "Juan",
    "lastName": "Pérez",
    "status": "active",
    "language": "es",
    "isPremium": false,
    "balance": 1500,
    "credits": 250,
    "totalPurchases": 5,
    "gameStatistics": {
      "totalGames": 45,
      "gamesWon": 30,
      "gamesLost": 12,
      "gamesDrawn": 2,
      "gamesAbandoned": 1,
      "winRate": 66.67,
      "lossRate": 26.67,
      "drawRate": 4.44,
      "abandonRate": 2.22,
      "currentWinStreak": 3,
      "longestWinStreak": 8,
      "totalPlayTime": 5400,
      "avgGameDuration": 120,
      "totalPlayTimeFormatted": "1h 30m",
      "avgGameDurationFormatted": "2m 0s",
      "totalCreditsWon": 500,
      "totalCreditsLost": 200,
      "netCreditsFromGames": 300,
      "rating": 1150,
      "rankedGames": 20,
      "level": "Intermedio"
    },
    "opponentStatistics": {
      "totalOpponents": 15,
      "mostFrequentOpponent": {
        "telegramId": 987654321,
        "username": "rival123",
        "gamesPlayed": 8,
        "wins": 5,
        "losses": 3,
        "draws": 0,
        "winRateAgainst": 62.5
      },
      "recentOpponents": [...]
    },
    "metadata": {
      "registrationDate": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-15T10:30:00.000Z",
      "daysSinceRegistration": 15,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "flags": {
      "isNewUser": false,
      "isActivePlayer": true,
      "hasWinStreak": true,
      "isOnLossStreak": false,
      "canPlayRanked": true,
      "hasPlayedRecently": true
    }
  },
  "message": "Datos del usuario obtenidos exitosamente"
}
```

### 2. Obtener historial de juegos del usuario
**GET** `/api/users/{telegramId}/games`

**Parámetros de consulta:**
- `limit` (number, opcional): Número máximo de juegos (default: 10)
- `offset` (number, opcional): Número de juegos a omitir (default: 0)

### 3. Obtener juegos activos del usuario
**GET** `/api/users/{telegramId}/games/active`

### 4. Crear un nuevo juego
**POST** `/api/users/{telegramId}/games`

**Cuerpo de la petición:**
```json
{
  "gameId": "tap-reaction",
  "opponentTelegramId": 987654321,
  "gameType": "multiplayer",
  "creditsWagered": 50,
  "isRanked": true
}
```

**Tipos de juego disponibles:**
- `single_player`: Juego individual
- `multiplayer`: Juego multijugador
- `tournament`: Torneo

### 5. Actualizar estado de un juego
**PUT** `/api/users/{telegramId}/games/{gameId}`

**Cuerpo de la petición:**
```json
{
  "status": "won",
  "playerScore": 100,
  "opponentScore": 80,
  "creditsWon": 100,
  "gameData": {...},
  "notes": "Excelente juego!"
}
```

**Estados de juego disponibles:**
- `started`: Juego iniciado
- `completed`: Juego completado
- `abandoned`: Juego abandonado
- `won`: Juego ganado
- `lost`: Juego perdido
- `draw`: Empate

### 6. Abandonar un juego
**PUT** `/api/users/{telegramId}/games/{gameId}/abandon`

### 7. Obtener estadísticas del usuario
**GET** `/api/users/{telegramId}/stats`

### 8. Actualizar configuración del usuario
**PUT** `/api/users/{telegramId}/settings`

**Cuerpo de la petición:**
```json
{
  "language": "es",
  "notifications": true
}
```

## Endpoints de Plantillas de Juegos

### 1. Obtener juegos disponibles (reemplaza el mock del frontend)
**GET** `/api/game-templates`

**Parámetros de consulta:**
- `includeInactive` (boolean, opcional): Incluir juegos inactivos
- `category` (string, opcional): Filtrar por categoría
- `difficulty` (number, opcional): Filtrar por nivel de dificultad

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "tap-reaction",
      "name": "Tap Rápido",
      "description": "Reacciona más rápido que tu oponente cuando aparezca la señal",
      "entryCost": 50,
      "maxWinnings": 90,
      "backgroundImage": "⚡",
      "estimatedTime": "30 segundos",
      "isActive": true,
      "route": "/partida",
      "category": "reflejos",
      "difficultyLevel": 2,
      "tags": ["reflejos", "velocidad", "competitivo"],
      "totalGamesPlayed": 1250,
      "winRateMultiplier": 1.8
    }
  ],
  "message": "Juegos disponibles obtenidos exitosamente"
}
```

### 2. Obtener solo juegos activos
**GET** `/api/game-templates/active`

### 3. Obtener un juego específico
**GET** `/api/game-templates/{gameId}`

### 4. Obtener juegos por categoría
**GET** `/api/game-templates/category/{category}`

### 5. Buscar juegos
**GET** `/api/game-templates/search/{query}`

### 6. Crear nuevo juego (admin)
**POST** `/api/game-templates`

### 7. Actualizar juego (admin)
**PUT** `/api/game-templates/{gameId}`

### 8. Activar/desactivar juego (admin)
**PUT** `/api/game-templates/{gameId}/toggle`

### 9. Obtener estadísticas de un juego
**GET** `/api/game-templates/{gameId}/stats`

### 10. Inicializar juegos por defecto
**POST** `/api/game-templates/seed/initial`

## Endpoints de Juegos

### 1. Obtener detalles de un juego específico
**GET** `/api/games/{gameId}`

### 2. Obtener leaderboard por rating
**GET** `/api/games/leaderboard/rating`

**Parámetros de consulta:**
- `limit` (number, opcional): Número máximo de jugadores (default: 10, máximo: 100)
- `minGames` (number, opcional): Mínimo de juegos jugados (default: 5)

### 3. Obtener leaderboard por victorias
**GET** `/api/games/leaderboard/wins`

### 4. Obtener historial entre dos usuarios
**GET** `/api/games/between/{playerTelegramId}/{opponentTelegramId}`

### 5. Obtener estadísticas globales
**GET** `/api/games/stats/global`

## Códigos de Respuesta HTTP

- **200 OK**: Petición exitosa
- **201 Created**: Recurso creado exitosamente
- **400 Bad Request**: Error en los parámetros de la petición
- **404 Not Found**: Recurso no encontrado
- **500 Internal Server Error**: Error interno del servidor

## Formato de Respuesta

Todas las respuestas siguen el siguiente formato:

```json
{
  "success": boolean,
  "data": any,
  "message": string
}
```

## Ejemplos de Uso

### Crear un juego multijugador
```bash
curl -X POST http://localhost:3000/api/users/123456789/games \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "tap-reaction",
    "opponentTelegramId": 987654321,
    "gameType": "multiplayer",
    "creditsWagered": 50,
    "isRanked": true
  }'
```

### Obtener juegos disponibles (reemplaza el mockGames del frontend)
```bash
curl http://localhost:3000/api/game-templates/active
```

### Finalizar un juego como ganado
```bash
curl -X PUT http://localhost:3000/api/users/123456789/games/60f7b8c8e9d8f1234567890a \
  -H "Content-Type: application/json" \
  -d '{
    "status": "won",
    "playerScore": 100,
    "opponentScore": 80,
    "creditsWon": 100
  }'
```

### Obtener datos completos del usuario
```bash
curl http://localhost:3000/api/users/123456789
```

## Características Especiales

### Datos Enriquecidos del Usuario
El endpoint principal del usuario devuelve datos altamente procesados que incluyen:

- **Estadísticas calculadas**: Porcentajes de victorias, derrotas, empates
- **Rachas**: Racha actual y máxima de victorias
- **Tiempos formateados**: Duración total y promedio en formato legible
- **Nivel del usuario**: Calculado en base a juegos y rating
- **Balance neto**: Créditos ganados menos créditos perdidos
- **Oponente más frecuente**: Con estadísticas específicas
- **Flags útiles**: Indicadores booleanos para el frontend

### Gestión Automática de Estadísticas
- Las estadísticas se actualizan automáticamente al finalizar los juegos
- Se mantiene historial contra oponentes específicos
- Se calculan ratings y rachas automáticamente
- Se controlan límites de compras y créditos

### Validaciones
- Verificación de usuarios existentes
- Validación de créditos suficientes
- Control de permisos (solo el jugador puede modificar sus juegos)
- Validación de estados de juego 