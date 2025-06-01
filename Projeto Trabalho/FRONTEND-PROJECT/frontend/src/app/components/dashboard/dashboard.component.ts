/**
 * @component DashboardComponent
 * @description Componente principal de dashboard que permite:
 *  - Selecionar restaurante por tipo (pickup/delivery)
 *  - Navegar pelos menus e refeições disponíveis
 *  - Adicionar itens ao carrinho
 *  - Ver comentários de restaurantes
 *  - Aceder ao carrinho sobreposto
 *  - Localizar restaurantes no mapa
 *  - Efetuar logout
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CartOverlayComponent } from '../cartOverlay/cart-overlay.component';
import { Restaurant } from '../../services/restaurants/restaurants.service';
import { CartService } from '../../services/cart/cart.service';
import { OrderService } from '../../services/orders/order.service';
import { RestaurantLocatorComponent } from '../restaurant-locator/restaurant-locator.component';
import { CommentsListComponent } from '../comment-list/comment-list.component';
import { ImageService } from '../../services/image/image.service';
import { AuthRestService } from '../../services/auth/auth-rest-service.service';

/**
 * Interface que representa um menu de restaurante
 */
interface Menu {
  _id: string;
  name: string;
  meals: string[];
  isActive: boolean;
}

/**
 * Interface que representa uma refeição
 */
interface Meal {
  _id: string;
  name: string;
  description: string;
  sizes: { name: string; price: number }[];
  category: string[];
  images: { imagePath: string }[];
}
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CartOverlayComponent,
    CommentsListComponent,
    RouterModule,
    RestaurantLocatorComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  /** Restaurantes selecionados por tipo de pedido */
  private selectedByType: Record<'pickup' | 'delivery', Restaurant | null> = {
    pickup: null,
    delivery: null,
  };

  /** Menus guardados por tipo de pedido */
  private menuByType: Record<'pickup' | 'delivery', Menu | null> = {
    pickup: null,
    delivery: null,
  };

  /** Contador de itens no carrinho */
  cartItemCount = 0;

  /** Flags e mensagens para carregamento de menus */
  loadingMenus = false;
  errorMenus: string | null = null;
  /** ID do restaurante cujos comentários estão a ser visualizados */
  viewingCommentsFor: string | null = null;
  /** Restaurante atualmente selecionado */
  selectedRestaurant: Restaurant | null = null;

  /** Menu atualmente selecionado */
  selectedMenu: Menu | null = null;
  /** Flags e mensagens para carregamento de refeições */
  loadingMeals = false;
  errorMeals: string | null = null;
  /** Lista de refeições para exibição */
  mealsList: Meal[] = [];

    /**
   * @constructor
   * @param authService Serviço de autenticação para logout
   * @param router Router do Angular para navegação
   * @param cartService Serviço de gestão do carrinho
   * @param orderService Serviço de encomendas para limpar estado pendente
   * @param imageService Serviço para obter URLs de imagens
   */
  constructor(
    public authService: AuthRestService,
    private router: Router,
    private cartService: CartService,
    private orderService: OrderService,
    public imageService: ImageService
  ) {
    // Subscreve número de itens do carrinho para atualizar badge
    this.cartService.items$.subscribe(
      (items) =>
        (this.cartItemCount = items.reduce((sum, i) => sum + i.quantity, 0))
    );
  }

  /**
   * Lifecycle hook: inicialização do componente
   */
  ngOnInit(): void {}

  /**
   * Define restaurante selecionado e reseta menus/refeições se necessário
   * @param r Restaurante selecionado ou null
   */
  onRestaurantSelected(r: Restaurant | null) {
    if (!r) return;

    const t = this.cartService.getOrderType()!;
    const prev = this.selectedByType[t];

    this.selectedByType[t] = r;
    this.selectedRestaurant = r;

      // Reset de menu e lista de refeições ao mudar de restaurante
      if (!prev || prev._id !== r._id) {
      this.menuByType[t] = null;
      this.selectedMenu = null;
      this.mealsList = [];
    } else {
      this.selectedMenu = this.menuByType[t];
      this.mealsList = this.selectedMenu
        ? this.filterMeals(this.selectedMenu, r.meals)
        : [];
    }
  }

    /**
   * Muda tipo de pedido (pickup/delivery) e carrega estado anterior se existir
   * @param type Tipo de pedido selecionado
   */
  onTypeChange(type: 'pickup' | 'delivery') {
    this.cartService.setOrderType(type);
    // Reseta seleção de restaurante e refeições
    this.selectedRestaurant = null;
    this.selectedMenu = null;
    this.mealsList = [];

    const savedR = this.selectedByType[type];

    if (savedR) {
      this.selectedRestaurant = savedR;
      const savedM = this.menuByType[type];

      if (savedM) {
        this.selectedMenu = savedM;
        this.mealsList = this.filterMeals(savedM, savedR.meals);
      }
    }
  }

  /**
   * Getter: retorna menus ativos do restaurante selecionado
   */
  get activeMenus(): Menu[] {
    return this.selectedRestaurant?.menu?.filter((m) => m.isActive) ?? [];
  }

  /**
   * Seleciona um menu e filtra as refeições correspondentes
   * @param m Menu selecionado
   */
  selectMenu(m: Menu): void {
    if (!this.selectedRestaurant) return;

    const t = this.cartService.getOrderType()!;

    this.menuByType[t] = m;

    this.loadingMeals = true;
    this.errorMeals = null;

    this.selectedMenu = m;
    this.mealsList = this.filterMeals(m, this.selectedRestaurant.meals);

    this.loadingMeals = false;

    // Rolar suavemente para secção de refeições
    setTimeout(() => {
      const next = document.getElementById('after-menu-select');
      if (next) next.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

    /**
   * Adiciona refeição ao carrinho com tamanho e quantidade 1
   * @param meal Refeição a adicionar
   * @param sized Tamanho e preço selecionados
   */
  addToCart(meal: Meal, sized: { name: string; price: number }) {
    if (this.selectedRestaurant) {
      this.cartService.setRestaurant({
        id: this.selectedRestaurant._id,
        name: this.selectedRestaurant.name,
        location: this.selectedRestaurant.location,
        categories: this.selectedRestaurant.categories as string[],
      });
    }

    this.cartService.addItem(
      {
        _id: meal._id,
        name: meal.name,
        description: meal.description,
        images: meal.images,
        category: meal.category,
      },
      sized,
      1
    );
  }

    /**
   * Exibe comentários de um restaurante
   * @param id ID do restaurante
   */
  viewComments(id: string) {
    this.viewingCommentsFor = id;
  }

  /**
   * Fecha o painel de comentários
   */
  closeComments() {
    this.viewingCommentsFor = null;
  }

  /**
   * Efetua logout do utilizador e limpa estado de carrinho e encomendas
   */
  onLogout(): void {
    this.authService.logout();
    this.cartService.logoutCleanup();
    this.orderService.clearPending();
    this.router.navigate(['/']);
  }

  /**
   * Getter: retorna ID do restaurante atualmente no carrinho
   */
  get cartRestaurantId(): string | null {
    const snap = this.cartService.getRestaurantSnapshot();
    return snap?.id ?? null;
  }

  /**
   * Getter: retorna tipo de pedido guardado no carrinho
   */
  get cartOrderType(): 'pickup' | 'delivery' | null {
    return this.cartService.getOrderType();
  }

  /**
   * Filtra lista de refeições para conter apenas as do menu selecionado
   * @param menu Menu com IDs de refeições
   * @param allMeals Todos os objetos Meal disponíveis
   * @returns Array de Meal filtradas
   */
  private filterMeals(menu: Menu, allMeals: Meal[]): Meal[] {
    const ids = new Set(menu.meals.map((id) => id.toString()));

    return allMeals.filter((meal) => ids.has(meal._id.toString()));
  }

  /**
   * Controla slideshow manual de imagens de refeição
   * @param index Índice do slide a ativar
   * @param mealId ID da refeição que contém o slideshow
   */
  showSlide(index: number, mealId: string) {
    const slideshow = document.querySelector(
      `[data-meal-id="${mealId}"] .card-slideshow`
    );
    if (slideshow) {
      const slides = slideshow.querySelectorAll('.slide');
      const indicators = slideshow.querySelectorAll('.indicator');

      slides.forEach((s) => s.classList.remove('active'));
      indicators.forEach((i) => i.classList.remove('active'));

      slides[index].classList.add('active');
      indicators[index].classList.add('active');
    }
  }
}
