# Ejemplos de Respuestas - Casos Sin Transacciones

Este documento muestra cómo responde la API cuando un usuario no tiene transacciones o cuando no se encuentran resultados.

## 1. Usuario Nuevo (Sin Transacciones)

### Endpoint: `GET /transactions/user/{telegramId}`

**Caso**: Usuario que nunca ha tenido transacciones.

```json
{
  "success": true,
  "data": {
    "transactions": [],
    "stats": {
      "totalTransactions": 0,
      "totalWins": 0,
      "totalLosses": 0,
      "totalDraws": 0,
      "totalIncome": 0,
      "totalExpenses": 0,
      "totalRefunds": 0,
      "netAmount": 0,
      "totalBetAmount": 0,
      "totalWinnings": 0,
      "totalGames": 0,
      "winPercentage": 0
    },
    "user": {
      "telegramId": 123456789,
      "username": "nuevo_usuario",
      "firstName": "Juan",
      "currentBalance": 0
    },
    "pagination": {
      "limit": 20,
      "offset": 0,
      "hasMore": false,
      "total": 0
    },
    "meta": {
      "hasTransactions": false,
      "isFirstTime": true,
      "isEmpty": true,
      "isFiltered": false
    }
  },
  "message": "Usuario sin transacciones aún. ¡Comienza jugando o comprando créditos!"
}
```

## 2. Usuario con Actividad pero Sin Resultados por Filtros

### Endpoint: `GET /transactions/user/{telegramId}?type=MATCH&itemType=WIN`

**Caso**: Usuario que tiene transacciones pero ninguna coincide con los filtros aplicados.

```json
{
  "success": true,
  "data": {
    "transactions": [],
    "stats": {
      "totalTransactions": 15,
      "totalWins": 3,
      "totalLosses": 8,
      "totalDraws": 1,
      "totalIncome": 3,
      "totalExpenses": 0,
      "totalRefunds": 0,
      "netAmount": 250,
      "totalBetAmount": 800,
      "totalWinnings": 600,
      "totalGames": 12,
      "winPercentage": 25.0
    },
    "user": {
      "telegramId": 123456789,
      "username": "jugador_activo",
      "firstName": "María",
      "currentBalance": 150
    },
    "pagination": {
      "limit": 20,
      "offset": 0,
      "hasMore": false,
      "total": 15
    },
    "meta": {
      "hasTransactions": false,
      "isFirstTime": false,
      "isEmpty": true,
      "isFiltered": true
    }
  },
  "message": "No se encontraron transacciones con los filtros aplicados"
}
```

## 3. Estadísticas de Usuario Sin Actividad

### Endpoint: `GET /transactions/stats/{telegramId}`

**Caso**: Usuario nuevo sin estadísticas.

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalTransactions": 0,
      "totalWins": 0,
      "totalLosses": 0,
      "totalDraws": 0,
      "totalIncome": 0,
      "totalExpenses": 0,
      "totalRefunds": 0,
      "netAmount": 0,
      "totalBetAmount": 0,
      "totalWinnings": 0,
      "totalGames": 0,
      "winPercentage": 0
    },
    "user": {
      "telegramId": 123456789,
      "username": "nuevo_usuario",
      "firstName": "Juan",
      "currentBalance": 0
    },
    "meta": {
      "hasActivity": false,
      "isNewUser": true
    }
  },
  "message": "Usuario sin actividad aún. Las estadísticas se mostrarán después de la primera transacción."
}
```

## 4. Usuario con Transacciones - Página Vacía

### Endpoint: `GET /transactions/user/{telegramId}?offset=100&limit=20`

**Caso**: Usuario solicita una página que no existe.

```json
{
  "success": true,
  "data": {
    "transactions": [],
    "stats": {
      "totalTransactions": 25,
      "totalWins": 8,
      "totalLosses": 12,
      "totalDraws": 2,
      "totalIncome": 3,
      "totalExpenses": 0,
      "totalRefunds": 0,
      "netAmount": 500,
      "totalBetAmount": 1200,
      "totalWinnings": 1000,
      "totalGames": 22,
      "winPercentage": 36.36
    },
    "user": {
      "telegramId": 123456789,
      "username": "jugador_veterano",
      "firstName": "Carlos",
      "currentBalance": 300
    },
    "pagination": {
      "limit": 20,
      "offset": 100,
      "hasMore": false,
      "total": 25
    },
    "meta": {
      "hasTransactions": false,
      "isFirstTime": false,
      "isEmpty": false,
      "isFiltered": false
    }
  },
  "message": "No se encontraron transacciones con los filtros aplicados"
}
```

## Campos de Control para Frontend

### `meta` Object
- **`hasTransactions`**: `boolean` - Si la página actual tiene transacciones
- **`isFirstTime`**: `boolean` - Si el usuario nunca ha tenido transacciones
- **`isEmpty`**: `boolean` - Si estamos en la primera página y no hay resultados
- **`isFiltered`**: `boolean` - Si se aplicaron filtros en la búsqueda

### `pagination` Object
- **`total`**: `number` - Total de transacciones del usuario (sin filtros)
- **`hasMore`**: `boolean` - Si hay más páginas disponibles
- **`limit`** y **`offset`**: Para control de paginación

### Uso Recomendado en Frontend

```javascript
// Detectar casos especiales
if (response.data.meta.isFirstTime) {
  // Mostrar mensaje de bienvenida con CTA para comprar créditos o jugar
  showWelcomeMessage();
} else if (response.data.meta.isEmpty && response.data.meta.isFiltered) {
  // Mostrar mensaje de "no results" con opción para limpiar filtros
  showNoResultsWithFilters();
} else if (response.data.meta.isEmpty) {
  // Página vacía sin filtros (offset muy alto)
  showEmptyPage();
} else if (!response.data.meta.hasTransactions) {
  // Página actual vacía pero hay datos en otras páginas
  showPaginationInfo();
}

// El array transactions siempre será válido (nunca null)
response.data.transactions.forEach(transaction => {
  // Procesar transacciones normalmente
});

// Las estadísticas siempre tendrán estructura completa
const winRate = response.data.stats.winPercentage; // Ya viene calculado
const totalGames = response.data.stats.totalGames;  // Total de partidas jugadas
const hasPlayedGames = totalGames > 0;
```

## Nuevos Campos de Estadísticas de Partidas

### Campos Agregados
- **`totalGames`**: `number` - Total de partidas jugadas (wins + losses + draws)
- **`winPercentage`**: `number` - Porcentaje de victorias redondeado a 2 decimales (0-100)

### Ejemplos de Cálculo
```javascript
// Ejemplos de estadísticas de partidas
const stats = {
  totalWins: 8,
  totalLosses: 12,
  totalDraws: 2,
  totalGames: 22,      // 8 + 12 + 2 = 22
  winPercentage: 36.36 // (8 / 22) * 100 = 36.36%
};

// Uso en frontend
if (stats.totalGames === 0) {
  showMessage("¡Aún no has jugado ninguna partida!");
} else {
  showGameStats(`${stats.totalGames} partidas jugadas, ${stats.winPercentage}% de victorias`);
}
```

## Ventajas de Esta Implementación

1. **Consistencia**: Siempre hay estructura de datos, nunca `null` o `undefined`
2. **Información Contextual**: Los campos `meta` permiten mostrar mensajes específicos
3. **Estadísticas Completas**: Incluso usuarios nuevos tienen objeto `stats` completo con datos de partidas
4. **Cálculos Pre-hechos**: El porcentaje de victorias viene calculado desde el backend
5. **Frontend-Friendly**: Fácil de manejar en React/Vue/Angular sin verificaciones complejas
6. **Mensajes Dinámicos**: La API proporciona mensajes contextuales apropiados 