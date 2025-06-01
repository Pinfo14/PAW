/**
 * @service ClientService
 * @description Serviço para interagir com endpoints de perfil de cliente:
 *  - Recupera e atualiza dados de perfil
 *  - Recupera e atualiza localização de entrega
 *  - Permite alteração de password de cliente
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Representação de um endereço simples
 */
export interface Address {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

/**
 * Modelo de localização contendo endereço e coordenadas geográficas
 */
export interface LocationModel {
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  coordinates: { lat: number; lon: number };
}

/**
 * Estrutura de dados do perfil do cliente retornado pela API
 */
export interface ClientProfile {
  id: string;
  email: string;
  name: string;
  nif: string;
  contact: string;
  address: Address;
  deliveryAddress: Address;
}

@Injectable({
  providedIn: 'root',
})

export class ClientService {
  /** URL base da API de cliente */
  private api = 'http://localhost:3000/api';
  
  /**
   * @constructor
   * @param http HttpClient para efetuar requisições HTTP
   */
  constructor(private http: HttpClient) {}

  /**
   * Obtém perfil completo do cliente autenticado
   * @returns Observable de ClientProfile com dados do cliente
   */
  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.api}/client/profile`);
  }

  /**
   * Obtém localização de entrega do cliente (mesmos dados de profile)
   * @returns Observable de LocationModel com endereço e coordenadas
   */
  getDeliveryLocation(): Observable<LocationModel> {
    return this.http.get<LocationModel>(`${this.api}/client/profile`);
  }

  /**
   * Atualiza dados principais do perfil do cliente
   * @param payload Objeto parcial contendo campos a atualizar
   * @returns Observable de ClientProfile com dados atualizados
   */
  updateProfile(payload: Partial<ClientProfile>): Observable<ClientProfile> {
    return this.http.patch<ClientProfile>(
      `${this.api}/client/updateProfile`,
      payload
    );
  }

  /**
   * Atualiza morada de entrega do cliente
   * @param loc Objeto com campos street, postalCode, city e opcional country
   * @returns Observable de LocationModel com a nova localização
   */
  updateDeliveryLocation(loc: {
    street: string;
    postalCode: string;
    city: string;
    country?: string;
  }): Observable<LocationModel> {
    return this.http.put<LocationModel>(
      `${this.api}/client/delivery-location`,
      loc
    );
  }

  /**
   * Altera a password do cliente autenticado
   * @param current Password atual do cliente
   * @param next Nova password a ser definida
   * @returns Observable<void> que completa quando a operação tiver sucesso
   */
  changePassword(current: string, next: string): Observable<void> {
    return this.http.put<void>(`${this.api}/client/updatePassword`, {
      currentPassword: current,
      newPassword: next,
    });
  }
}
