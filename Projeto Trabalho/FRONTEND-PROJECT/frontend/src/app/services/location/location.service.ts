/**
 * @service LocationService
 * @description Serviço para geocodificação, armazenamento local de localização do cliente
 * e cálculo de distância entre coordenadas via API externa.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Representa coordenadas geográficas (latitude e longitude).
 */
export interface Coords {
  lat: number;
  lon: number;
}

/**
 * Estrutura de resultado retornada pelo endpoint de distância.
 */
export interface DistanceResult {
  distance: number;
}
@Injectable({ providedIn: 'root' })
export class LocationService {
  /** URL base para os endpoints de geocodificação e cálculo de distância */
  private readonly geoUrl = 'http://localhost:3000/api/geo';

  /** Latitude do cliente armazenada em memória */
  private clientLat: number | null = null;
  /** Longitude do cliente armazenada em memória */
  private clientLon: number | null = null;

  /**
   * @constructor
   * @param http HttpClient para chamadas HTTP aos serviços de geocodificação
   */
  constructor(private http: HttpClient) {
    // Tenta carregar coordenadas armazenadas no localStorage
    const storedLat = localStorage.getItem('client_lat');
    const storedLon = localStorage.getItem('client_lon');
    if (storedLat && storedLon) {
      this.clientLat = parseFloat(storedLat);
      this.clientLon = parseFloat(storedLon);
    }
  }

  /**
   * Geocodifica uma morada para coordenadas usando o endpoint de geocodificação.
   * @param street Nome da rua
   * @param postalCode Código postal (e.g. 1234-567)
   * @param city Cidade da morada
   * @returns Observable com Coords contendo lat e lon
   */
  geocode(
    street: string,
    postalCode: string,
    city: string
  ): Observable<Coords> {
    return this.http.post<Coords>(this.geoUrl, { street, postalCode, city, country: 'Portugal'});
  }

  /**
   * Armazena coordenadas do cliente em memória e no localStorage.
   * @param lat Latitude a definir
   * @param lon Longitude a definir
   */
  setLocation(lat: number, lon: number): void {
    this.clientLat = lat;
    this.clientLon = lon;
    localStorage.setItem('client_lat', lat.toString());
    localStorage.setItem('client_lon', lon.toString());
  }

  /**
   * Limpa coordenadas do cliente em memória e localStorage.
   */
  clearLocation(): void {
    this.clientLat = this.clientLon = null;
    localStorage.removeItem('client_lat');
    localStorage.removeItem('client_lon');
  }

  /**
   * Indica se as coordenadas do cliente estão definidas.
   * @returns true se lat e lon estiverem disponíveis, false caso contrário
   */
  hasLocation(): boolean {
    return this.clientLat !== null && this.clientLon !== null;
  }

  /**
   * Retorna as coordenadas do cliente.
   * @throws Error se as coordenadas não estiverem definidas
   * @returns Objeto Coords com lat e lon
   */
  getLocation(): { lat: number; lon: number } {
    if (!this.hasLocation()) {
    }
    return { lat: this.clientLat!, lon: this.clientLon! };
  }

  /**
   * Calcula distância entre duas coordenadas via endpoint externo.
   * @param from Coordenadas de origem
   * @param to Coordenadas de destino
   * @returns Observable com DistanceResult contendo distância calculada
   */
  getDistance(from: Coords, to: Coords): Observable<DistanceResult> {
    return this.http.post<DistanceResult>(`${this.geoUrl}/distance`, {
      from,
      to,
    });
  }
}
