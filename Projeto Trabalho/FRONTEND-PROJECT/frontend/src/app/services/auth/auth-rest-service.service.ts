/**
 * @service AuthRestService
 * @description Serviço de autenticação para login, registo, gestão de token e perfil de utilizador.
 * Comunica com o endpoint backend e armazena dados no localStorage, incluindo atualização de localização.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { LocationService } from '../location/location.service';
/** URL base do endpoint da API de autenticação */
const endpoint = 'http://localhost:3000/api/';

/**
 * Estrutura da resposta de autenticação retornada pelo backend.
 */
export interface AuthResponse {
  /** JWT de acesso */
  token: string;
  /** Dados de perfil do utilizador autenticado */
  user: {
    _id: string;
    email: string;
    role: string;
    name: string;
    nif: string;
    companyName?: string;
    contact: string;
    location: {
      address: {
        street: string;
        postalCode: string;
        city: string;
        country: string;
      };
      coordinates: { lat: number; lon: number };
    };
    deliveryLocation: {
      address: {
        street: string;
        postalCode: string;
        city: string;
        country: string;
      };
      coordinates: { lat: number; lon: number };
    };
  };
}

/**
 * Representa um endereço básico com rua, código postal, cidade e país.
 */
export interface Address {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

/**
 * Payload enviado ao backend para registo de novo utilizador.
 */
export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  nif: string;
  companyName?: string;
  contact: string;
  address: Address;
  isDeliverySame: boolean;
  deliveryAddress?: Address;
}

@Injectable({ providedIn: 'root' })
export class AuthRestService {
  /** Chave de armazenamento de perfil de utilizador no localStorage */
  private STORAGE_USER = 'user_profile';
  /** Chave de armazenamento de token no localStorage */
  private STORAGE_TOKEN = 'access_token';

  /**
   * @constructor
   * @param http HttpClient para chamadas HTTP ao backend
   * @param locationService Serviço para definir/limpar localização do utilizador
   * @param router Router para navegação após logout
   */
  constructor(
    private http: HttpClient,
    private locationService: LocationService,
    private router: Router
  ) {}

  /**
   * Executa login do utilizador enviando email e password.
   * Armazena token e perfil no localStorage e atualiza localização.
   *
   * @param email Email do utilizador
   * @param password Password do utilizador
   * @returns Observable de AuthResponse com token e dados de utilizador
   */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${endpoint}auth/login`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem('access_token', res.token);
          localStorage.setItem(this.STORAGE_USER, JSON.stringify(res.user));
          const coords = res.user.location?.coordinates;
          if (coords) {
            this.locationService.setLocation(coords.lat, coords.lon);
          }
        })
      );
  }

  /**
   * Persiste manualmente o token JWT no localStorage.
   * @param token Token JWT a armazenar
   */
  setToken(token: string): void {
    localStorage.setItem(this.STORAGE_TOKEN, token);
  }

  /**
   * Recupera token JWT armazenado no localStorage.
   * @returns Token ou null se não existir
   */
  getToken(): string | null {
    return localStorage.getItem(this.STORAGE_TOKEN);
  }

  /**
   * Efetua logout removendo token e perfil do localStorage,
   * limpa localização e navega para a página inicial.
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_TOKEN);
    localStorage.removeItem(this.STORAGE_USER);

    this.locationService.clearLocation();
    this.router.navigate(['/']);
  }

  /**
   * Regista novo utilizador enviando payload ao endpoint.
   * @param payload Dados para registo de utilizador
   * @returns Observable de AuthResponse com token e dados de utilizador
   */
  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
    .post<AuthResponse>(`${endpoint}auth/register`, payload)
    .pipe(
      tap((res) => {
        // 1. store token
        localStorage.setItem(this.STORAGE_TOKEN, res.token);
        // 2. store full user profile
        localStorage.setItem(this.STORAGE_USER, JSON.stringify(res.user));
        // 3. inicializar LocationService, se vier coordenadas
        const coords = res.user.location?.coordinates;
        if (coords) {
          this.locationService.setLocation(coords.lat, coords.lon);
        }
      })
    );
  }

  /**
   * Recupera dados de perfil de utilizador armazenados no localStorage.
   * @returns Objeto de perfil ou null se não existir
   */
  getStoredUser(): AuthResponse['user'] | null {
    const raw = localStorage.getItem(this.STORAGE_USER);
    return raw ? JSON.parse(raw) : null;
  }
}
