import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GameTemplatesService } from '../db/game-templates.service';
import { CreditPacksService } from '../db/credit-packs.service';

@Injectable()
export class InitializationService implements OnModuleInit {
  private readonly logger = new Logger(InitializationService.name);

  constructor(
    private readonly gameTemplatesService: GameTemplatesService,
    private readonly creditPacksService: CreditPacksService,
  ) {}

  async onModuleInit() {
    this.logger.log('Iniciando configuración inicial de la aplicación...');

    try {
      // Inicializar plantillas de juegos
      await this.gameTemplatesService.seedInitialGames();

      // Inicializar packs de créditos
      await this.creditPacksService.seedInitialPacks();

      this.logger.log('Configuración inicial completada exitosamente');
    } catch (error) {
      this.logger.error('Error durante la inicialización:', error);
    }
  }
}
