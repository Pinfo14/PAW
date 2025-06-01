/**
 * @component CartOverlayComponent
 * @description Componente independente para mostrar e gerir o carrinho de compras.
 * Permite visualizar itens, iniciar checkout, limpar carrinho e verifica blacklist antes de prosseguir.
 */
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CartService,
  CartItem,
  RestaurantSnapshot,
} from '../../services/cart/cart.service';
import { OrderService } from '../../services/orders/order.service';
import { Router } from '@angular/router';
import { AuthRestService } from '../../services/auth/auth-rest-service.service';

@Component({
  selector: 'app-cart-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-overlay.component.html',
  styleUrls: ['./cart-overlay.component.css'],
})
export class CartOverlayComponent {
  /** Indicador do estado de abertura do overlay */
  open = signal(false);

  /** Snapshot do restaurante associado ao carrinho */
  cartRestaurant: RestaurantSnapshot | null = null;
  /** Lista de itens no carrinho */
  items: CartItem[] = [];

  /** Coordenadas do cliente para validações de entrega */
  userLat!: number;
  userLon!: number;

  /** Indica se existe uma encomenda pendente no sistema */
  hasPending = false;

  /**
   * @constructor
   * @param authService Serviço de autenticação para verificar token do utilizador
   * @param cartService Serviço de carrinho para gerir itens e obter dados do carrinho
   * @param router Router do Angular para navegação programática
   * @param orderService Serviço de encomendas para verificar blacklist e estado pendente
   */
  constructor(
    private authService: AuthRestService,
    private cartService: CartService,
    private router: Router,
    private orderService: OrderService
  ) {
    // Subscreve mudanças no carrinho para atualizar lista de itens
    this.cartService.items$.subscribe((items) => (this.items = items));
    // Obtém snapshot do restaurante selecionado
    this.cartRestaurant = this.cartService.getRestaurantSnapshot();
    // Subscreve estado de encomenda pendente
    this.orderService.pending$.subscribe((p) => (this.hasPending = !!p));
    // Se existir cliente autenticado, guarda coordenadas para validações
    const customer = this.cartService.getCustomerSnapshot();
    if (customer) {
      this.userLat = customer.deliveryLocation.coordinates.lat;
      this.userLon = customer.deliveryLocation.coordinates.lon;
    }
  }

 /**
   * Alterna visibilidade do overlay do carrinho
   */
  toggle() {
    this.open.update((o) => !o);
  }

  /**
   * Inicia o processo de checkout:
   * 1. Verifica autenticação do utilizador
   * 2. Verifica existência de restaurante e tipo de pedido
   * 3. Confirma ausência de encomenda pendente
   * 4. Verifica blacklist antes de prosseguir
   * 5. Navega para página de checkout com dados no state
   */
  startCheckout() {
    // Se não autenticado, redireciona para login com returnUrl
    if (!this.authService.getToken()) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/checkout' },
      });
      return;
    }
    const restaurant = this.cartService.getRestaurantSnapshot();
    const items = this.items;
    const total = this.cartService.getTotal();
    const orderType = this.cartService.getOrderType();

    // Verifica dados essenciais
    if (!restaurant || !orderType) {
      alert('Algo correu mal: restaurante ou tipo de pedido indefinido.');
      return;
    }
    // Impede se existe encomenda pendente
    if (this.hasPending) {
      alert('Já tens um pedido em curso. Acompanha em “Meus Pedidos”.');
      return;
    }

    // Verifica blacklist antes de navegar para checkout
    this.orderService.checkBlacklist().subscribe({
      next: () => {
        this.toggle();
        this.router.navigate(['/checkout'], {
          state: { restaurant, items, total, orderType },
        });
      },
      error: (err) => {
        // Se for blacklist, mostra motivo e validade
        if (err.status === 403 && err.error) {
          const until = new Date(err.error.until).toLocaleDateString();
          alert(
            `${err.error.error}\nMotivo: ${err.error.reason}\nAté: ${until}`
          );
        } else {
          alert(
            'Erro ao verificar autorização de encomenda. Tente mais tarde.'
          );
        }
      },
    });
  }

  /**
   * Limpa todos os itens do carrinho após confirmação do utilizador
   */
  onClearCart() {
    if (confirm('Tem a certeza que quer esvaziar o carrinho?')) {
      this.cartService.clearItems();
      this.cartRestaurant = null;
      this.items = [];
      this.toggle();
    }
  }
}
