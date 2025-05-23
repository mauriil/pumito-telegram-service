import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameTemplate, GameTemplateDocument } from './schemas/game-template.schema';

export interface CreateGameTemplateDto {
  gameId: string;
  name: string;
  description: string;
  entryCost: number;
  maxWinnings: number;
  backgroundImage: string;
  estimatedTime: string;
  route: string;
  isActive?: boolean;
  minPlayersToStart?: number;
  maxPlayers?: number;
  difficultyLevel?: number;
  category?: string;
  tags?: string[];
  winRateMultiplier?: number;
  gameConfig?: any;
}

@Injectable()
export class GameTemplatesService {
  private readonly logger = new Logger(GameTemplatesService.name);

  constructor(
    @InjectModel(GameTemplate.name) private readonly gameTemplateModel: Model<GameTemplateDocument>,
  ) {}

  async createGameTemplate(createDto: CreateGameTemplateDto): Promise<GameTemplateDocument> {
    const gameTemplate = new this.gameTemplateModel(createDto);
    return gameTemplate.save();
  }

  async findAll(includeInactive = false): Promise<GameTemplateDocument[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return this.gameTemplateModel.find(filter).sort({ name: 1 });
  }

  async findByGameId(gameId: string): Promise<GameTemplateDocument | null> {
    return this.gameTemplateModel.findOne({ gameId });
  }

  async findById(id: string): Promise<GameTemplateDocument | null> {
    return this.gameTemplateModel.findById(id);
  }

  async findActiveGames(): Promise<GameTemplateDocument[]> {
    return this.gameTemplateModel.find({ isActive: true }).sort({ name: 1 });
  }

  async findByCategory(category: string): Promise<GameTemplateDocument[]> {
    return this.gameTemplateModel.find({ 
      category, 
      isActive: true 
    }).sort({ name: 1 });
  }

  async findByDifficultyLevel(level: number): Promise<GameTemplateDocument[]> {
    return this.gameTemplateModel.find({ 
      difficultyLevel: level, 
      isActive: true 
    }).sort({ name: 1 });
  }

  async updateGameTemplate(gameId: string, updateData: Partial<CreateGameTemplateDto>): Promise<GameTemplateDocument> {
    const gameTemplate = await this.gameTemplateModel.findOneAndUpdate(
      { gameId },
      updateData,
      { new: true }
    );
    
    if (!gameTemplate) {
      throw new NotFoundException('Plantilla de juego no encontrada');
    }
    
    return gameTemplate;
  }

  async toggleActive(gameId: string): Promise<GameTemplateDocument> {
    const gameTemplate = await this.findByGameId(gameId);
    if (!gameTemplate) {
      throw new NotFoundException('Plantilla de juego no encontrada');
    }

    gameTemplate.isActive = !gameTemplate.isActive;
    return gameTemplate.save();
  }

  async incrementStats(gameId: string, playersCount = 1): Promise<void> {
    await this.gameTemplateModel.findOneAndUpdate(
      { gameId },
      {
        $inc: {
          totalGamesPlayed: 1,
          totalPlayersParticipated: playersCount
        }
      }
    );
  }

  async getGameStats(gameId: string): Promise<any> {
    const gameTemplate = await this.findByGameId(gameId);
    if (!gameTemplate) {
      throw new NotFoundException('Plantilla de juego no encontrada');
    }

    return {
      gameId: gameTemplate.gameId,
      name: gameTemplate.name,
      totalGamesPlayed: gameTemplate.totalGamesPlayed,
      totalPlayersParticipated: gameTemplate.totalPlayersParticipated,
      averagePlayersPerGame: gameTemplate.totalGamesPlayed > 0 ? 
        (gameTemplate.totalPlayersParticipated / gameTemplate.totalGamesPlayed) : 0,
      isActive: gameTemplate.isActive,
    };
  }

  async searchGames(query: string): Promise<GameTemplateDocument[]> {
    return this.gameTemplateModel.find({
      isActive: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    }).sort({ name: 1 });
  }

  // Método para inicializar los juegos del frontend
  async seedInitialGames(): Promise<void> {
    const existingGames = await this.gameTemplateModel.countDocuments();
    if (existingGames > 0) {
      this.logger.log('Los juegos ya están inicializados');
      return;
    }

    const initialGames: CreateGameTemplateDto[] = [
      {
        gameId: 'tap-reaction',
        name: 'Tap Rápido',
        description: 'Reacciona más rápido que tu oponente cuando aparezca la señal',
        entryCost: 50,
        maxWinnings: 90,
        backgroundImage: '⚡',
        estimatedTime: '30 segundos',
        route: '/partida',
        isActive: true,
        category: 'reflejos',
        difficultyLevel: 2,
        tags: ['reflejos', 'velocidad', 'competitivo'],
        winRateMultiplier: 1.8
      },
      {
        gameId: 'memory-cards',
        name: 'Memoria de Cartas',
        description: 'Encuentra las parejas de cartas en el menor tiempo posible',
        entryCost: 75,
        maxWinnings: 140,
        backgroundImage: '🎴',
        estimatedTime: '2 minutos',
        route: '/memory-game',
        isActive: false,
        category: 'memoria',
        difficultyLevel: 3,
        tags: ['memoria', 'cartas', 'concentración'],
        winRateMultiplier: 1.9
      },
      {
        gameId: 'word-puzzle',
        name: 'Puzzle de Palabras',
        description: 'Resuelve el puzzle de palabras antes que tu oponente',
        entryCost: 100,
        maxWinnings: 180,
        backgroundImage: '🧩',
        estimatedTime: '3 minutos',
        route: '/word-puzzle',
        isActive: false,
        category: 'lógica',
        difficultyLevel: 4,
        tags: ['palabras', 'lógica', 'vocabulario'],
        winRateMultiplier: 1.8
      },
      {
        gameId: 'color-match',
        name: 'Coincidencia de Colores',
        description: 'Combina los colores correctos en una secuencia',
        entryCost: 60,
        maxWinnings: 110,
        backgroundImage: '🌈',
        estimatedTime: '45 segundos',
        route: '/color-match',
        isActive: false,
        category: 'percepción',
        difficultyLevel: 2,
        tags: ['colores', 'secuencia', 'visual'],
        winRateMultiplier: 1.8
      },
      {
        gameId: 'number-sequence',
        name: 'Secuencia Numérica',
        description: 'Completa la secuencia numérica más rápido que tu rival',
        entryCost: 80,
        maxWinnings: 150,
        backgroundImage: '🔢',
        estimatedTime: '1 minuto',
        route: '/number-sequence',
        isActive: false,
        category: 'lógica',
        difficultyLevel: 3,
        tags: ['números', 'secuencia', 'matemáticas'],
        winRateMultiplier: 1.9
      },
      {
        gameId: 'trivia-challenge',
        name: 'Desafío Trivia',
        description: 'Responde preguntas de cultura general y gana puntos',
        entryCost: 120,
        maxWinnings: 220,
        backgroundImage: '🧠',
        estimatedTime: '4 minutos',
        route: '/trivia',
        isActive: false,
        category: 'conocimiento',
        difficultyLevel: 4,
        tags: ['trivia', 'conocimiento', 'cultura general'],
        winRateMultiplier: 1.8
      }
    ];

    try {
      await this.gameTemplateModel.insertMany(initialGames);
      this.logger.log('Juegos iniciales creados exitosamente');
    } catch (error) {
      this.logger.error('Error creando juegos iniciales', error);
    }
  }
} 