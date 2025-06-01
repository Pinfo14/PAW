/**
 * @service OrderService
 * @description Serviço para gerir encomendas: histórico, encomenda pendente em tempo real via SSE,
 * criação, cancelamento e verificação de blacklist do cliente.
 */import { Injectable, NgZone, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';

/**
 * Item simplificado de encomenda para exibição em histórico
 */
export interface OrderItem {
  name: string;
  size: string;
  price: number;
  image: string | null;
}

/**
 * Encomenda exibida no histórico de encomendas
 */
export interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  status: string;
  meals: OrderItem[];
}

/**
 * Coordenadas e morada de cliente ou restaurante
 */
export interface Location {
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  coordinates: {
    lat: number;
    lon: number;
  };
}

/**
 * Snapshot dos dados do cliente usado em encomenda pendente
 */
export interface CustomerSnapshot {
  _id: string;
  name: string;
  email: string;
  nif: string;
  contact: string;
  companyName?: string;
  role: string;
  location: Location;
  deliveryLocation: Location;
}

/**
 * Snapshot de restaurante usado em encomenda pendente
 */
export interface RestaurantSnapshot {
  name: string;
  location: Location;
  categories: string[];
}

/**
 * Dados do trabalhador atribuídos à encomenda
 */
export interface Worker {
  name: string;
  email: string;
}

/**
 * Tamanho e preço de uma refeição na encomenda
 */
export interface MealSize {
  name: string;
  price: number;
}


/**
 * Imagem de uma refeição
 */
export interface MealImage {
  imagePath: string;
}

/**
 * Refeição completa na encomenda pendente
 */
export interface OrderMeal {
  _id: string;
  name: string;
  description: string;
  sizes: MealSize[];
  category: string[];
  images: MealImage[];
}
/** Estado possível de uma encomenda */
export type OrderStatus = 'Ordered' | 'Preparing' | 'Ready' | 'Delivered';

/**
 * Modelo de encomenda criada ou pendente retornado pelo backend
 */
export interface CreatedOrder {
  _id: string;
  customer: CustomerSnapshot;
  restaurant: RestaurantSnapshot;
  restaurantId: string;
  worker: Worker;
  meals: OrderMeal[];
  canceledMeal: boolean;
  createdAt: string;
  deliveredAt: string | null;
  currentStatus: OrderStatus;
  preparationTime: number;
  pickupCode?: string;
}

/**
 * Entrada simplificada de encomenda pendente armazenada localmente
 */
export interface PendingEntry {
  id: string;
  pickupCode?: string;
}

// Chave de armazenamento em localStorage para encomenda pendente
const PENDING_KEY = 'pending_orders';

@Injectable({ providedIn: 'root' })
export class OrderService {
  /** URL base da API de encomendas */
  readonly apiUrl = 'http://localhost:3000/api';

   /**
   * BehaviorSubject que emite encomenda pendente ou null
   */
  private pendingSubject = new BehaviorSubject<CreatedOrder | null>(null);
  
  /**
   * Observable público para encomenda pendente
   */
  pending$ = this.pendingSubject.asObservable();
  
   /**
   * Signal que armazena histórico de encomendas para reatividade
   */
  orders = signal<Order[]>([]);

   /**
   * @constructor
   * @param http HttpClient para chamadas HTTP
   * @param ngZone NgZone para executar callback retornado de SSE dentro da zona Angular
   */
  constructor(private http: HttpClient, private ngZone: NgZone) {
    this.loadHistory();
    this.initPending();
    this.listenToOrderEvents();
  }

   /**
   * Carrega histórico de encomendas e atualiza o signal `orders`
   */
  private loadHistory() {
    this.http
      .get<Order[]>(`${this.apiUrl}/orders/historico`)
      .subscribe((list) => {
        this.orders.set(list);
      });
  }

  /**
   * Obtém histórico de encomendas como Observable
   * @returns Observable de array de Order
   */
  getHistory(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/orders/historico`);
  }

  /**
   * Inicializa escuta de eventos SSE para atualizações de encomenda
   */
  private listenToOrderEvents() {
    this.connectStream();
  }

   /**
   * Conecta a endpoint SSE `/orders/stream` e trata eventos 'order-updated'
   */
  private connectStream() {
    const url = `${this.apiUrl}/orders/stream`;
    const es = new EventSource(url);

    es.onopen = () => console.log('[SSE] aberto');
    es.onmessage = (evt) => {
      const { type, order } = JSON.parse(evt.data);
      if (type !== 'order-updated') return;
      this.ngZone.run(() => {
        const cur = this.pendingSubject.value;
        if (cur?._id === order._id) {
          if (order.canceledMeal || order.currentStatus === 'Delivered') {
            this.clearPending();
          } else {
            this.setPending(order);
          }
        }
      });
    };
    es.onerror = (err) => {
      console.error('[SSE] erro, reconnecting in 5s', err);
      es.close();
      setTimeout(() => this.connectStream(), 5000);
    };
  }

    /**
   * Cria uma nova encomenda via POST e define como pendente
   * @param payload Dados da encomenda a criar
   * @returns Observable de CreatedOrder
   */
  createOrder(payload: any): Observable<CreatedOrder> {
    return this.http
      .post<CreatedOrder>(`${this.apiUrl}/orders/createOrder`, payload)
      .pipe(tap((order) => this.setPending(order)));
  }

    /**
   * Inicializa encomenda pendente recuperando do backend e localStorage
   */
  public async initPending() {
    try {
      const full = await firstValueFrom(
        this.http.get<CreatedOrder | null>(`${this.apiUrl}/orders/pending`)
      );
      if (full) {
        this.setPending(full);
      } else {
        this.clearPending();
      }
    } catch (err) {
      console.error('[OrderService] initPending erro:', err);
      this.clearPending();
    }
  }

   /**
   * Armazena encomenda pendente tanto em localStorage quanto no BehaviorSubject
   * @param order Objeto CreatedOrder a definir como pendente
   */
  private setPending(order: CreatedOrder) {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        _id: order._id,
        pickupCode: order.pickupCode,
        meals: order.meals,
        currentStatus: order.currentStatus,
        createdAt: order.createdAt,
      })
    );
    this.pendingSubject.next(order);
  }

  /**
   * Limpa encomenda pendente de localStorage e BehaviorSubject
   */
  clearPending() {
    localStorage.removeItem('pending_orders');
    this.pendingSubject.next(null);
  }

  /**
   * Cancela encomenda no backend e limpa pendente em seguida
   * @param orderId ID da encomenda a cancelar
   * @returns Observable que emite a resposta e limpa pendente
   */
  cancelOrder(orderId: string): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/orders/${orderId}/cancel`, {})
      .pipe(tap(() => this.clearPending()));
  }

  /**
   * Verifica se o cliente está em blacklist para novas encomendas
   * @returns Observable com possível erro, motivo e data de expiração
   */
  checkBlacklist(): Observable<{
    error?: string;
    reason?: string;
    until?: string;
  }> {
    return this.http.get<{ error?: string; reason?: string; until?: string }>(
      `${this.apiUrl}/orders/checkBlacklist`
    );
  }
}
