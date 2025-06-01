/**
 * @service CartService
 * @description Serviço singleton que gerencia o estado do carrinho de compras:
 *  - Armazena e recupera itens do carrinho (persistência em localStorage)
 *  - Mantém snapshot de restaurante e cliente
 *  - Controla tipo de encomenda (pickup/delivery)
 *  - Calcula total e prepara payload para checkout
 *  - Integra com o backend para validação de delivery
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthRestService } from '../auth/auth-rest-service.service';

/** Snapshot mínimo do perfil do cliente armazenado no carrinho */
export interface CustomerSnapshot {
  _id: string;
  email: string;
  name: string;
  role: string;
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
}

/** Snapshot mínimo de restaurante armazenado no carrinho */
export interface RestaurantSnapshot {
  id: string;
  name: string;
  location: {
    address: {
      street: string;
      postalCode: string;
      city: string;
      country: string;
    };
    coordinates: { lat: number; lon: number };
  };
  categories: string[];
}

/** Payload gerado para envio de checkout ao backend */
interface CheckoutPayload {
  restaurant: RestaurantSnapshot;
  items: CartItem[];
  total: number;
  orderType: 'pickup' | 'delivery';
}

/** Item do carrinho representando uma refeição selecionada */
export interface CartItem {
  meal: {
    _id: string;
    name: string;
    description: string;
    images?: { imagePath: string }[];
    category?: string[];
  };
  selectedSize: { name: string; price: number };
  quantity: number;
}

/** Retorno da API de validação de delivery */
export interface DeliveryCheck {
  ok: boolean;
  distance: number;
  maxRange: number;
}

// Chaves de armazenamento em localStorage
const CART_ITEMS_KEY = 'cart_items';
const CART_RESTAURANT_KEY = 'cart_restaurant';
const CART_ORDER_TYPE_KEY = 'cart_order_type';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly baseUrl = 'http://localhost:3000/api/orders';
  /** BehaviorSubject com lista de itens do carrinho */
  private itemsSubject = new BehaviorSubject<CartItem[]>([]);
  /** Observable público para componentes subscreverem mudanças no carrinho */
  items$ = this.itemsSubject.asObservable();

  /** Snapshot do restaurante associado ao carrinho */
  private restaurantSnapshot: RestaurantSnapshot | null = null;
  /** Snapshot do cliente autenticado */
  private customerSnapshot: CustomerSnapshot | null = null;
  /** Tipo de encomenda selecionado ('pickup' ou 'delivery') */
  private orderType: 'pickup' | 'delivery' | null = null;

  /**
   * @constructor
   * @param authService Serviço de autenticação para recuperar perfil de cliente
   * @param http HttpClient para chamadas ao backend
   */
  constructor(private authService: AuthRestService, private http: HttpClient) {
    // Inicializa snapshot de cliente se houver usuário armazenado
    const storedUser = this.authService.getStoredUser?.();

    if (storedUser) {
      this.customerSnapshot = {
        _id: storedUser._id,
        email: storedUser.email,
        name: storedUser.name,
        role: storedUser.role,
        nif: storedUser.nif,
        companyName: storedUser.companyName,
        contact: storedUser.contact,
        location: storedUser.location,
        deliveryLocation: storedUser.deliveryLocation,
      };
    }
    // Carrega itens persistidos no localStorage
    const storedItems = localStorage.getItem(CART_ITEMS_KEY);
    if (storedItems) {
      try {
        this.itemsSubject.next(JSON.parse(storedItems));
      } catch {}
    }

    // Carrega restaurante persistido
    const storedRest = localStorage.getItem(CART_RESTAURANT_KEY);
    if (storedRest) {
      try {
        this.restaurantSnapshot = JSON.parse(storedRest);
      } catch {}
    }

    // Carrega tipo de encomenda persistido
    const storedType = localStorage.getItem(CART_ORDER_TYPE_KEY);
    if (storedType === 'pickup' || storedType === 'delivery') {
      this.orderType = storedType;
    }

    // Persiste automaticamente alterações na lista de itens
    this.itemsSubject.subscribe((items) => {
      localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
    });
  }

  /**
   * Retorna snapshot atual do restaurante ou null
   */
  getRestaurantSnapshot(): RestaurantSnapshot | null {
    return this.restaurantSnapshot;
  }

  /**
   * Retorna snapshot do cliente ou null
   */
  getCustomerSnapshot(): CustomerSnapshot | null {
    return this.customerSnapshot;
  }

  /**
   * Retorna tipo de encomenda selecionado ou null
   */
  getOrderType(): 'pickup' | 'delivery' | null {
    return this.orderType;
  }

  /**
   * Retorna lista atual de itens do carrinho
   */
  getItems(): CartItem[] {
    return this.itemsSubject.value;
  }

  /**
   * Atualiza snapshot do cliente (não persiste)
   * @param c Novo snapshot de cliente
   */
  setCustomerSnapshot(c: CustomerSnapshot) {
    this.customerSnapshot = c;
  }

  /**
   * Atualiza snapshot de restaurante e persiste no localStorage
   * @param rest Snapshot de restaurante a armazenar
   */
  setRestaurant(rest: RestaurantSnapshot) {
    this.restaurantSnapshot = rest;
    localStorage.setItem(CART_RESTAURANT_KEY, JSON.stringify(rest));
  }

  /**
   * Define tipo de encomenda se o carrinho estiver vazio e persiste
   * @param type 'pickup' ou 'delivery'
   */
  setOrderType(type: 'pickup' | 'delivery') {
    if (this.itemsSubject.value.length === 0) {
      this.orderType = type;
      localStorage.setItem(CART_ORDER_TYPE_KEY, type);
    }
  }

  /**
   * Adiciona ou acumula item no carrinho e persiste estado
   * @param meal Dados da refeição
   * @param selectedSize Tamanho e preço selecionados
   * @param qty Quantidade a adicionar (default 1)
   */
  addItem(
    meal: CartItem['meal'],
    selectedSize: CartItem['selectedSize'],
    qty = 1
  ) {
    if (this.itemsSubject.value.length === 0) {
      localStorage.setItem(
        CART_RESTAURANT_KEY,
        JSON.stringify(this.restaurantSnapshot)
      );
      localStorage.setItem(CART_ORDER_TYPE_KEY, this.orderType!);
    }

    const items = [...this.itemsSubject.value];
    const idx = items.findIndex(
      (i) =>
        i.meal._id === meal._id && i.selectedSize.name === selectedSize.name
    );

    if (idx > -1) {
      items[idx].quantity += qty;
    } else {
      items.push({ meal, selectedSize, quantity: qty });
    }

    this.itemsSubject.next(items);
  }

  /**
   * Remove item específico do carrinho
   * @param mealId ID da refeição a remover
   * @param sizeName Nome do tamanho a remover
   */
  removeItem(mealId: string, sizeName: string) {
    const filtered = this.getItems().filter(
      (i) => !(i.meal._id === mealId && i.selectedSize.name === sizeName)
    );
    this.itemsSubject.next(filtered);
  }

  /**
   * Atualiza quantidade de um item específico
   * @param mealId ID da refeição
   * @param sizeName Nome do tamanho
   * @param quantity Nova quantidade
   */
  updateQuantity(mealId: string, sizeName: string, quantity: number) {
    const updated = this.getItems().map((i) =>
      i.meal._id === mealId && i.selectedSize.name === sizeName
        ? { ...i, quantity }
        : i
    );
    this.itemsSubject.next(updated);
  }

  /**
   * Chama endpoint para validar se a morada do cliente está no alcance de entrega
   * @param restaurantId ID do restaurante
   * @param userLat Latitude do cliente
   * @param userLon Longitude do cliente
   * @returns Observable com resultado de validação
   */
  validateDelivery(
    restaurantId: string,
    userLat: number,
    userLon: number
  ): Observable<DeliveryCheck> {
    return this.http.post<DeliveryCheck>(`${this.baseUrl}/validateDelivery`, {
      restaurantId,
      userLat,
      userLon,
    });
  }

  /**
   * Limpa apenas os itens e restaurante armazenados no carrinho
   */
  clearItems(): void {
    this.itemsSubject.next([]);
    this.restaurantSnapshot = null;
    localStorage.removeItem(CART_ITEMS_KEY);
    localStorage.removeItem(CART_RESTAURANT_KEY);
  }

  /**
   * Limpa todo o estado do carrinho, incluindo tipo de encomenda
   */
  clear(): void {
    this.itemsSubject.next([]);
    this.restaurantSnapshot = null;
    this.orderType = null;
    localStorage.removeItem(CART_ITEMS_KEY);
    localStorage.removeItem(CART_RESTAURANT_KEY);
    localStorage.removeItem(CART_ITEMS_KEY);
    localStorage.removeItem(CART_ORDER_TYPE_KEY);
  }

  /**
   * Cleanup a executar no logout para limpar o carrinho completamente
   */
  logoutCleanup() {
    this.clear();
  }

  /**
   * Calcula o valor total do carrinho
   * @returns Soma de preço*quantidade para cada item
   */
  getTotal(): number {
    return this.getItems().reduce(
      (sum, i) => sum + i.selectedSize.price * i.quantity,
      0
    );
  }

  /**
   * Prepara payload de checkout se houver dados válidos no carrinho
   * @returns Payload ou null se dados insuficientes
   */
  getCheckoutPayload(): CheckoutPayload | null {
    const rest = this.getRestaurantSnapshot();
    const items = this.getItems();
    const orderType = this.getOrderType();
    if (!rest || items.length === 0 || !orderType) return null;
    return {
      restaurant: rest,
      items,
      total: this.getTotal(),
      orderType,
    };
  }
}
