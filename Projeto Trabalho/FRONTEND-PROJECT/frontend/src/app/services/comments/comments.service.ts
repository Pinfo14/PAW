/**
 * @service CommentsService
 * @description Serviço para gerir comentários de clientes em restaurantes:
 *  - Recupera lista de comentários de um restaurante específico
 *  - Cria novos comentários com texto e imagens (base64)
 */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CommentsService {
  /** URL base dos endpoints de comentários no backend */
  private readonly url = 'http://localhost:3000/api/restaurants/comment';
  
  /**
   * @constructor
   * @param http HttpClient para fazer requisições HTTP
   */
  constructor(private http: HttpClient) {}

  /**
   * Obtém todos os comentários para um restaurante dado
   * @param restaurantId ID do restaurante cujos comentários serão listados
   * @returns Observable de array de CommentModel
   */
  listByRestaurant(restaurantId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.url}/${restaurantId}`);
  }

  /**
   * Cria um novo comentário para um restaurante
   * @param data Payload contendo texto, ID do restaurante e imagens em base64
   * @returns Observable com o comentário criado ou resposta do servidor
   */
  create(data: {
    text: string;
    restaurantId: string;
    images: string[];
  }): Observable<any> {
    return this.http.post<any>(`${this.url}/create`, data);
  }
}
