# 🤖 Telegram Gaming Bot API Documentation

## 📚 Introducción

Esta documentación describe la API completa del **Telegram Gaming Bot**, diseñada para soportar un sistema de juegos con compras in-app, gestión de usuarios, y pagos integrados.

### 🌐 URLs de Acceso

- **Desarrollo**: `http://localhost:3000`
- **Documentación Swagger**: `http://localhost:3000/api-docs`
- **API Base URL**: `http://localhost:3000/api`

### 🔐 Autenticación

La API soporta dos tipos de autenticación:

1. **Bearer Token (JWT)**: Para endpoints administrativos
   ```
   Authorization: Bearer <jwt_token>
   ```

2. **API Key**: Para comunicación server-to-server
   ```
   X-API-Key: <api_key>
   ```

---

## 🎫 **CREDIT PACKS** - Gestión de Packs de Créditos

### 📋 Endpoints Principales

#### `GET /api/credit-packs` - Obtener Packs Disponibles
**Descripción**: Retorna todos los packs de créditos disponibles para compra, optimizado para consumo del frontend.

**Query Parameters**:
- `includeInactive` (boolean, opcional): Incluir packs inactivos
- `category` (string, opcional): Filtrar por categoría (`starter`, `value`, `premium`, `offer`, `special`)
- `includePaymentLinks` (boolean, opcional): Incluir links de pago (default: true)

**Response Ejemplo**:
```json
{
  "success": true,
  "data": [
    {
      "id": "premium-pack-2024",
      "title": "Pack Premium",
      "description": "Ideal para usuarios que buscan el máximo valor en créditos",
      "amount": 2500,
      "price": 19.99,
      "popular": true,
      "features": [
        "Mejor relación precio-valor",
        "Créditos bonus",
        "Soporte prioritario"
      ],
      "currency": "USD",
      "emoji": "💎",
      "color": "#9C27B0",
      "category": "premium",
      "bonusCredits": 500,
      "discountPercentage": 25,
      "originalPrice": 24.99,
      "paymentLink": "/api/payments/create-payment-link/premium-pack-2024",
      "paymentMethods": ["stripe", "paypal", "mercadopago"]
    }
  ],
  "message": "Packs de créditos obtenidos exitosamente",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/credit-packs"
}
```

#### `GET /api/credit-packs/active` - Packs Activos Únicamente
**Descripción**: Versión simplificada que retorna solo packs activos con payment links incluidos.

#### `GET /api/credit-packs/popular` - Packs Populares
**Descripción**: Retorna packs marcados como populares para destacar en la UI.

#### `GET /api/credit-packs/category/{category}` - Packs por Categoría
**Descripción**: Filtra packs por categoría específica.

**Path Parameters**:
- `category`: `starter` | `value` | `premium` | `offer` | `special`

#### `GET /api/credit-packs/{packId}` - Detalles de Pack Específico
**Descripción**: Información detallada de un pack, incluyendo metadatos y estadísticas.

#### `POST /api/credit-packs` - Crear Nuevo Pack 🔒
**Descripción**: Crea un nuevo pack de créditos (solo administradores).

**Request Body**:
```json
{
  "packId": "premium-pack-2024",
  "title": "Pack Premium",
  "description": "Ideal para usuarios que buscan el máximo valor en créditos",
  "amount": 2500,
  "price": 19.99,
  "popular": true,
  "features": [
    "Mejor relación precio-valor",
    "Créditos bonus",
    "Soporte prioritario"
  ],
  "currency": "USD",
  "bonusCredits": 500,
  "emoji": "💎",
  "color": "#9C27B0",
  "category": "premium",
  "paymentMethods": ["stripe", "paypal", "mercadopago"]
}
```

#### `PUT /api/credit-packs/{packId}` - Actualizar Pack 🔒
**Descripción**: Actualización parcial de un pack existente.

#### `PUT /api/credit-packs/{packId}/toggle` - Alternar Estado 🔒
**Descripción**: Activa/desactiva rápidamente un pack.

#### `GET /api/credit-packs/{packId}/stats` - Estadísticas de Pack 🔒
**Descripción**: Métricas detalladas del pack incluyendo ventas y revenue.

**Response Ejemplo**:
```json
{
  "success": true,
  "data": {
    "packId": "premium-pack-2024",
    "title": "Pack Premium",
    "totalPurchases": 156,
    "totalRevenue": 3119.44,
    "averageRevenuePerPurchase": 19.99,
    "isActive": true,
    "popular": true
  }
}
```

#### `GET /api/credit-packs/stats/global` - Estadísticas Globales 🔒
**Descripción**: Métricas consolidadas de todos los packs para BI y reporting.

#### `POST /api/credit-packs/seed/initial` - Inicializar Packs por Defecto 🔒
**Descripción**: Crea el set inicial de packs si no existen.

---

## 👥 **USERS** - Gestión de Usuarios

### 📋 Endpoints Principales

#### `GET /api/users` - Listado de Usuarios 🔒
**Descripción**: Lista paginada de todos los usuarios (solo administradores).

**Query Parameters**:
- `status` (string, opcional): Filtrar por estado (`active`, `suspended`, `banned`, `pending`)
- `search` (string, opcional): Buscar por nombre o username
- `limit` (number, opcional): Número de usuarios a retornar (max 100)
- `offset` (number, opcional): Número de usuarios a saltar

**Response Ejemplo**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "507f1f77bcf86cd799439011",
        "telegramId": 123456789,
        "firstName": "Juan",
        "lastName": "Pérez",
        "fullName": "Juan Pérez",
        "username": "juanperez",
        "email": "juan@example.com",
        "balance": 15.50,
        "credits": 2500,
        "status": "active",
        "isVerified": true,
        "totalGamesPlayed": 45,
        "totalGamesWon": 28,
        "winRate": 62.22,
        "totalPurchases": 3,
        "totalSpent": 45.97,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-20T15:45:00.000Z",
        "lastLoginAt": "2024-01-20T15:45:00.000Z"
      }
    ],
    "total": 156,
    "limit": 20,
    "offset": 0
  }
}
```

#### `GET /api/users/{telegramId}` - Usuario por Telegram ID
**Descripción**: Información detallada de un usuario específico.

#### `POST /api/users` - Crear Usuario 🔒
**Descripción**: Crea una nueva cuenta de usuario.

**Request Body**:
```json
{
  "telegramId": 123456789,
  "firstName": "Juan",
  "lastName": "Pérez",
  "username": "juanperez",
  "email": "juan@example.com",
  "balance": 0,
  "credits": 100
}
```

#### `PUT /api/users/{telegramId}` - Actualizar Usuario 🔒
**Descripción**: Actualización parcial de información del usuario.

#### `POST /api/users/{telegramId}/balance` - Actualizar Balance 🔒
**Descripción**: Añade o resta del balance del usuario con auditoría.

**Request Body**:
```json
{
  "amount": 25.50,
  "reason": "Purchase refund"
}
```

**Response Ejemplo**:
```json
{
  "success": true,
  "data": {
    "newBalance": 35.50,
    "previousBalance": 10.00,
    "changeAmount": 25.50,
    "reason": "Purchase refund"
  }
}
```

#### `POST /api/users/{telegramId}/credits` - Actualizar Créditos 🔒
**Descripción**: Añade o resta créditos del usuario con auditoría.

#### `GET /api/users/{telegramId}/games` - Juegos del Usuario
**Descripción**: Historial completo de juegos del usuario.

**Query Parameters**:
- `status` (string, opcional): Filtrar por estado del juego
- `gameType` (string, opcional): Filtrar por tipo de juego
- `limit` (number, opcional): Límite de resultados

#### `POST /api/users/{telegramId}/games` - Crear Juego
**Descripción**: Crea una nueva sesión de juego para el usuario.

**Request Body**:
```json
{
  "gameId": "tap-reaction",
  "gameType": "tap-reaction",
  "creditsWagered": 50,
  "isRanked": true,
  "opponentTelegramId": 987654321
}
```

#### `GET /api/users/{telegramId}/stats` - Estadísticas del Usuario
**Descripción**: Métricas completas del usuario.

**Response Ejemplo**:
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "telegramId": 123456789,
    "displayName": "Juan Pérez",
    "balance": 15.50,
    "credits": 2500,
    "totalGamesPlayed": 45,
    "totalGamesWon": 28,
    "winRate": 62.22,
    "totalPurchases": 3,
    "totalSpent": 45.97,
    "status": "active",
    "lastActivityAt": "2024-01-20T15:45:00.000Z"
  }
}
```

---

## 💰 **PAYMENTS** - Gestión de Pagos

### 📋 Endpoints Principales

#### `POST /webhook/mercadopago` - Webhook de MercadoPago
**Descripción**: Webhook para procesar notificaciones de MercadoPago.

**Request Body**:
```json
{
  "action": "payment.created",
  "data": {
    "id": "payment_id"
  },
  "type": "payment"
}
```

---

## 🎮 **GAME TEMPLATES** - Plantillas de Juegos

### 📋 Endpoints Principales

#### `GET /api/game-templates` - Obtener Plantillas
**Descripción**: Lista todas las plantillas de juegos disponibles.

#### `POST /api/game-templates` - Crear Plantilla 🔒
**Descripción**: Crea una nueva plantilla de juego.

#### `PUT /api/game-templates/{gameId}` - Actualizar Plantilla 🔒
**Descripción**: Actualiza una plantilla existente.

---

## 📊 **GAMES** - Gestión de Juegos

### 📋 Endpoints Principales

#### `GET /api/games` - Obtener Juegos
**Descripción**: Lista juegos con filtros y paginación.

#### `GET /api/games/{gameId}` - Detalles de Juego
**Descripción**: Información detallada de un juego específico.

---

## 🔄 **Formato de Respuesta Estándar**

Todos los endpoints retornan respuestas en el siguiente formato:

```json
{
  "success": boolean,
  "data": any,
  "message": string,
  "timestamp": "ISO 8601 string",
  "path": "request path"
}
```

---

## ⚠️ **Códigos de Estado HTTP**

- **200**: OK - Operación exitosa
- **201**: Created - Recurso creado exitosamente
- **400**: Bad Request - Datos inválidos o error de negocio
- **401**: Unauthorized - Autenticación requerida
- **403**: Forbidden - Permisos insuficientes
- **404**: Not Found - Recurso no encontrado
- **422**: Unprocessable Entity - Errores de validación
- **500**: Internal Server Error - Error del servidor

---

## 🚀 **Casos de Uso del Backoffice**

### Para Credit Packs:
1. **Dashboard de Ventas**: Usar `/api/credit-packs/stats/global`
2. **Gestión de Catálogo**: CRUD completo de packs
3. **Análisis por Pack**: Métricas individuales por pack
4. **Configuración de Ofertas**: Activar/desactivar packs

### Para Users:
1. **Panel de Usuarios**: Lista completa con filtros
2. **Soporte al Cliente**: Ajustes de balance y créditos
3. **Analytics de Usuarios**: Estadísticas de gaming y gastos
4. **Gestión de Estados**: Suspender/activar usuarios

### Para Games:
1. **Monitoreo de Juegos**: Estado de sesiones activas
2. **Estadísticas de Gaming**: Performance por tipo de juego
3. **Resolución de Disputas**: Historial completo de partidas

---

## 🛠️ **Configuración de Desarrollo**

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run start:dev

# La documentación estará disponible en:
# http://localhost:3000/api-docs
```

---

## 📝 **Notas Importantes**

1. **Autenticación**: Los endpoints marcados con 🔒 requieren autenticación Bearer Token
2. **Rate Limiting**: Implementado para evitar abuso de la API
3. **Validación**: Todos los inputs son validados usando class-validator
4. **Auditoría**: Cambios de balance y créditos son auditados automáticamente
5. **Transacciones**: Operaciones críticas usan transacciones de base de datos

---

## 🔗 **Enlaces Útiles**

- **Swagger UI**: `/api-docs`
- **Health Check**: `/health` (cuando esté implementado)
- **Metrics**: `/metrics` (cuando esté implementado)

---

*Esta documentación fue generada para el desarrollo del backoffice administrativo del Telegram Gaming Bot.* 