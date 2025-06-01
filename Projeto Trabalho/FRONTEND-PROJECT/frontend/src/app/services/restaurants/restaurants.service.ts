/**
 * @service RestaurantsService
 * @description Serviço para interagir com endpoints de restaurantes:
 *  - Recupera restaurantes ativos ou por localização
 *  - Obtém detalhes de restaurante, menus e refeições por menu
 *  - Lista categorias de restaurantes
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Representa um endereço simples com informações de rua, código postal, cidade e país.
 */
export interface Address {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

/**
 * Coordenadas geográficas (latitude e longitude).
 */
export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Modelo de localização completa de restaurante, incluindo _id, endereço e coordenadas.
 */
export interface Location {
  _id: string;
  address: Address;
  coordinates: Coordinates;
}

/**
 * Representa um menu de restaurante com o seu _id, nome, lista de refeições e estado de ativação.
 */
export interface Menu {
  _id: string;
  name: string;
  meals: string[];
  isActive: boolean;
}

/**
 * Representa um tamanho disponível de refeição com preço.
 */
export interface Size {
  _id: string;
  name: string;
  price: number;
}

/**
 * Modelo de imagem de refeição armazenando caminho.
 */
export interface MealImage {
  _id: string;
  imagePath: string;
}

/**
 * Dados completos de uma refeição do restaurante.
 */
export interface Meal {
  _id: string;
  name: string;
  description: string;
  sizes: Size[];
  category: string[];
  images: MealImage[];
}

/**
 * Representação de um restaurante com detalhes, menus e lista de refeições.
 */
export interface Restaurant {
  _id: string;
  name: string;
  location: Location;
  maxOrders: number;
  approvedByAdmin: boolean;
  maxDeliveryRange: number;
  categories: string[];
  categoriesNames?: string[];
  nif: string;
  companyName: string;
  createdAt: string;
  menu: Menu[];
  meals: Meal[];
  distance?: number;
  image: string;
}

/**
 * Modelo de categoria de restaurante (_id e nome).
 */
export interface Category {
  _id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class RestaurantsService {
  /** URL base da API de restaurantes */
  private readonly baseUrl = 'http://localhost:3000/api/restaurants';

  /**
   * @constructor
   * @param http HttpClient para chamadas HTTP à API
   */
  constructor(private http: HttpClient) {}

  /**
   * Recupera todos os restaurantes aprovados (ativos).
   * @returns Observable de array de Restaurant
   */
  getActive(): Observable<Restaurant[]> {
    return this.http.get<Restaurant[]>(this.baseUrl);
  }

  /**
   * Obtém detalhes completos de um restaurante pelo seu ID.
   * @param id ID do restaurante
   * @returns Observable de Restaurant
   */
  getById(id: string): Observable<Restaurant> {
    return this.http.get<Restaurant>(`${this.baseUrl}/${id}`);
  }

  /**
   * Obtém lista de refeições ativas de um menu específico de um restaurante.
   * @param restaurantId ID do restaurante
   * @param menuId ID do menu
   * @returns Observable de array de Meal
   */
  getMealsByMenu(restaurantId: string, menuId: string): Observable<Meal[]> {
    return this.http.get<Meal[]>(
      `${this.baseUrl}/${restaurantId}/menus/${menuId}/meals`
    );
  }

  /**
   * Procura restaurantes próximos de uma localização com base no tipo de serviço e categoria opcional.
   * @param lat Latitude do ponto de referência
   * @param lon Longitude do ponto de referência
   * @param type Tipo de serviço ('pickup' ou 'delivery')
   * @param category (Opcional) ID de categoria para filtrar restaurantes
   * @returns Observable de array de Restaurant ordenados por proximidade
   */
  getByLocation(
    lat: number,
    lon: number,
    type: 'pickup' | 'delivery',
    category?: string
  ): Observable<Restaurant[]> {
    const params: Record<string, string> = {
      lat: lat.toString(),
      lon: lon.toString(),
      type,
    };

    if (category) {
      params['category'] = category;
    }
    return this.http.get<Restaurant[]>(`${this.baseUrl}/location`, {
      params,
    });
  }

  /**
   * Recupera todas as categorias de restaurantes disponíveis no sistema.
   * @returns Observable de array de Category
   */
  getCategories(): Observable<{ _id: string; name: string }[]> {
    return this.http.get<{ _id: string; name: string }[]>(
      `${this.baseUrl}/categories`
    );
  }
}
