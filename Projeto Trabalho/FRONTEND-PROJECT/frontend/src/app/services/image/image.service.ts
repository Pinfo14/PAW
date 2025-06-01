/**
 * @service ImageService
 * @description Serviço para gerar URLs de imagens de restaurantes e refeições,
 * lidando com paths ausentes ou URLs completas.
 */
import { Injectable } from '@angular/core';

/** Configurações de ambiente para API */
const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};

@Injectable({
  providedIn: 'root',
})
export class ImageService {
  /** URL base para carregar imagens (API ou fallback) */
  private readonly baseUrl = environment.apiUrl || 'http://localhost:3000';

  /**
   * Gera URL completa para imagem de restaurante.
   * Substitui path ausente por placeholder padrão.
   *
   * @param imagePath Caminho relativo da imagem no servidor
   * @returns URL completa da imagem ou placeholder
   */
  getRestaurantImageUrl(imagePath: string): string {
    if (!imagePath) {
      return `${this.baseUrl}/uploads/restaurants/restaurant-placeholder.png`;
    }
    return `${this.baseUrl}/uploads/restaurants/${imagePath}`;
  }

  /**
   * Gera URL completa para imagem de refeição.
   * Aceita URLs absolutas ou paths relativos, e fallback para placeholder.
   *
   * @param imagePath Caminho relativo ou URL absoluta da imagem
   * @returns URL completa ou absoluta da imagem
   */
  getMealImageUrl(imagePath: string): string {
    if (!imagePath) {
      return `${this.baseUrl}/uploads/restaurants/meal-placeholder.jpg`;
    }
    // Se já for URL completa, retorna diretamente
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    return `${this.baseUrl}/uploads/${imagePath}`;
  }
}
