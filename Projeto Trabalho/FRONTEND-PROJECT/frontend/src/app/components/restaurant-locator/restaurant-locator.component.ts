/**
 * @component RestaurantLocatorComponent
 * @description Componente standalone que permite ao utilizador encontrar restaurantes
 * com base em localização (pickup ou delivery), filtrar por categoria ou termo de procura,
 * e selecionar restaurante para adicionar ao carrinho ou ver detalhes.
 */
import { Component, OnInit, Output, Input, EventEmitter } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  RestaurantsService,
  Restaurant,
} from '../../services/restaurants/restaurants.service';
import { CommonModule } from '@angular/common';
import {
  LocationService
} from '../../services/location/location.service';
import { ClientService, LocationModel } from '../../services/client/client.service';
import { CategoryFilterComponent } from '../restaurant-filters/restaurant-filters.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { catchError, take } from 'rxjs/operators';
import { ImageService } from '../../services/image/image.service';
import { of } from 'rxjs';
import { AuthRestService } from '../../services/auth/auth-rest-service.service';

@Component({
  selector: 'app-restaurant-locator',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    SearchBarComponent,
    CategoryFilterComponent,
  ],
  templateUrl: './restaurant-locator.component.html',
  providers: [ImageService],
})

export class RestaurantLocatorComponent implements OnInit {
  /** Número de itens atualmente no carrinho */
  @Input() cartItemCount!: number;
  /** ID do restaurante já no carrinho, para bloqueio de mudança */
  @Input() cartRestaurantId!: string | null;
  /** Tipo de pedido atual no carrinho ('pickup' ou 'delivery') */
  @Input() cartOrderType!: 'pickup' | 'delivery' | null;

  /** Evento emitido quando um restaurante é selecionado */
  @Output() select = new EventEmitter<Restaurant>();
  /** Evento emitido ao mudar o tipo de pedido */
  @Output() typeChange = new EventEmitter<'pickup' | 'delivery'>();

  /** Evento para visualizar comentários de um restaurante */
  @Output() viewCommentsEmitter = new EventEmitter<string>();
  /** FormGroup para campos de localização e tipo de busca */
  form: FormGroup;
  /** Lista de restaurantes atualmente exibidos */
  restaurants: Restaurant[] = [];
  /** Flag de loading global */
  loading = false;
  /** Mensagem de erro geral */
  error: string | null = null;
  /** Restaurante cujo modal de detalhes está aberto */
  selectedModalRestaurant: Restaurant | null = null;

  // Listas de restaurantes por tipo e estado
  pickupList: Restaurant[] = [];
  deliveryList: Restaurant[] = [];
  unfilteredList: Restaurant[] = [];

  /** Todas as categorias disponíveis */
  fullCategories: { _id: string; name: string }[] = [];
  /** Categorias presentes na lista atual */
  availableCategories: { _id: string; name: string }[] = [];
  /** ID da categoria atualmente selecionada */
  selectedCategory = '';
  /** Última morada válida usada para delivery */
  lastAddress = { street: '', postalCode: '', city: '', country: 'Portugal' };
  private searchTerm = '';

  /**
   * @constructor
   * @param fb FormBuilder para criar o FormGroup de localização
   * @param rs Serviço de restaurantes para fetch de dados
   * @param locationService Serviço de geolocalização e geocodificação
   * @param clientService Serviço de cliente para obter morada de entrega
   * @param imageService Serviço para manipular URLs de imagens
   * @param authService Serviço de autenticação para verificar token
   */
  constructor(
    private fb: FormBuilder,
    private rs: RestaurantsService,
    private locationService: LocationService,
    private clientService: ClientService,
    public imageService: ImageService,
    private authService: AuthRestService
  ) {
    // Inicializa o formulário com validações básicas
    this.form = this.fb.group({
      type: ['pickup', Validators.required],
      street: ['', Validators.required],
      postalCode: [
        '',
        [Validators.required, Validators.pattern(/^\d{4}-\d{3}$/)],
      ],
      city: ['', Validators.required],
      country: ['Portugal'],
    });
  }

  /**
   * Lifecycle hook: carrega categorias, inicializa listas e define comportamento de mudança de tipo
   */
  ngOnInit() {
    // Carrega categorias do serviço
    this.rs.getCategories().subscribe({
      next: (cs) => (this.fullCategories = cs),
      error: () => (this.error = 'Erro ao carregar categorias'),
    });

    // Observa mudanças no tipo de pedido para recarregar listas
    this.form.get('type')!.valueChanges.subscribe((type) => {
      this.error = null;
      if (type === 'delivery') {
        // Preenche campos com última morada e carrega delivery
        this.form.patchValue(this.lastAddress, { emitEvent: false });
        if (this.authService.getToken() || this.locationService.hasLocation()) {
          this.unfilteredList = this.deliveryList;
          this.loadDelivery();
        } else {
          this.restaurants = [];
        }
      } else {
        // Mostra listas de pickup
        this.unfilteredList = this.pickupList;
        this.applyFilters();
      }
      this.typeChange.emit(type);
    });

    // Emite valor inicial de tipo
    this.typeChange.emit(this.form.value.type);

    // Se utilizador autenticado, carrega listas considerando morada guardada
    if (this.authService.getToken()) {
      this.loadPickup();
      this.clientService
        .getDeliveryLocation()
        .pipe(
          take(1),
          catchError(() => of(null))
        )
        .subscribe((userOrLoc) => {
          const deliveryLoc = (userOrLoc as any).coordinates
            ? (userOrLoc as LocationModel)
            : (userOrLoc as any)?.deliveryLocation;

          if (deliveryLoc?.coordinates) {
            this.lastAddress = deliveryLoc.address;
            this.locationService.setLocation(
              deliveryLoc.coordinates.lat,
              deliveryLoc.coordinates.lon
            );
            this.form.patchValue({ type: 'delivery' }, { emitEvent: true });
          }
        });
    } else {
      // Caso não autenticado, carrega todos os restaurantes ativos
      this.loadAllRestaurants();
    }
  }

  /**
   * Aplica filtros de categoria e termo de pesquisa à lista não filtrada
   */
  private applyFilters() {
    let list = this.selectedCategory
      ? this.unfilteredList.filter((r) =>
          r.categories.map(String).includes(this.selectedCategory)
        )
      : [...this.unfilteredList];

    if (this.searchTerm) {
      list = list.filter((r) => r.name.toLowerCase().includes(this.searchTerm));
    }

    this.restaurants = list;
    // Atualiza categorias disponíveis com base no novo conjunto
    this.availableCategories = this.fullCategories.filter((c) =>
      this.unfilteredList.some((r) => r.categories.map(String).includes(c._id))
    );
  }

  /**
   * Handler de mudança de categoria: atualiza seleção e reaplica filtros
   * @param catId ID da categoria escolhida
   */
  onCategoryChange(catId: string) {
    this.selectedCategory = catId;
    this.applyFilters();
  }

  /**
   * Confirma a morada de entrega, geocodifica e recarrega pickups e deliveries
   */
  confirmDeliveryAddress() {
    if (!this.form.valid) {
      this.error = 'Preencha todos os campos corretamente.';
      return;
    }
    const { street, postalCode, city, country } = this.form.value;
    this.form.patchValue(this.lastAddress);
    this.loading = true;
    this.error = null;

    const doFetch = (lat: number, lon: number) => {
      this.locationService.setLocation(lat, lon);
      this.lastAddress = { street, postalCode, city, country };
      this.form.patchValue(this.lastAddress);
      this.rs.getByLocation(lat, lon, 'pickup').subscribe({
        next: (pickup) => {
          this.pickupList = pickup;
          if (this.form.value.type === 'pickup') {
            this.unfilteredList = pickup;
            this.applyFilters();
          }
        },
        error: () => {},
      });

      this.rs.getByLocation(lat, lon, 'delivery').subscribe({
        next: (delivery) => {
          this.deliveryList = delivery;
          if (this.form.value.type === 'delivery') {
            this.unfilteredList = delivery;
            this.applyFilters();
          }
        },
        error: () =>
          (this.error = 'Erro ao carregar restaurantes de delivery.'),
      });

      this.select.emit(null!);
      this.loading = false;
    };

      // Atualiza morada no servidor e em seguida faz fetch
      if (this.authService.getToken()) {
      this.clientService
        .updateDeliveryLocation({ street, postalCode, city, country })
        .subscribe({
          next: (loc) => doFetch(loc.coordinates.lat, loc.coordinates.lon),
          error: () => {
            this.error = 'Não conseguimos validar a morada.';
            this.loading = false;
          },
        });
    } else {
       // Geocodifica localmente
       this.locationService.geocode(street, postalCode, city).subscribe({
        next: ({ lat, lon }) => doFetch(lat, lon),
        error: () => {
          this.error = 'Não conseguimos validar a morada localmente.';
          this.loading = false;
        },
      });
    }
  }

  /**
   * Carrega restaurantes disponíveis para pickup com base na localização
   */
  private loadPickup() {
    const { lat, lon } = this.locationService.getLocation();
    this.loading = true;
    this.rs
      .getByLocation(lat, lon, 'pickup')
      .pipe(take(1))
      .subscribe({
        next: (list) => {
          this.pickupList = list;
          this.unfilteredList = list;
          this.selectedCategory = '';
          if (this.form.value.type === 'pickup') {
            this.applyFilters();
          }
          this.loading = false;
        },
        error: () => {
          this.error = 'Erro ao carregar restaurantes de pickup';
          this.loading = false;
        },
      });
  }

  /**
   * Carrega restaurantes disponíveis para delivery com base na localização
   */
  private loadDelivery() {
    if (!this.locationService.hasLocation()) {
      this.restaurants = [];
      this.unfilteredList = [];
      this.availableCategories = [];
      this.loading = false;
      return;
    }
    const { lat, lon } = this.locationService.getLocation();
    this.loading = true;
    this.rs
      .getByLocation(lat, lon, 'delivery')
      .pipe(take(1))
      .subscribe({
        next: (list) => {
          this.deliveryList = list;
          this.unfilteredList = list;
          this.selectedCategory = '';
          if (this.form.value.type === 'delivery') {
            this.applyFilters();
          }
          this.loading = false;
        },
        error: () => {
          this.error = 'Erro ao carregar restaurantes de delivery';
          this.loading = false;
        },
      });
  }

  /**
   * Handler de término da pesquisa de texto
   * @param term Termo de pesquisa inserido pelo utilizador
   */
  onSearch(term: string) {
    this.searchTerm = term;
    this.applyFilters();
  }

  /**
   * Emite evento para visualizar comentários de determinado restaurante
   * @param restaurantId ID do restaurante a visualizar
   */
  viewCommentsClick(restaurantId: string) {
    this.viewCommentsEmitter.emit(restaurantId);
  }

  /**
   * Emite evento de seleção de restaurante e rola para vista de menus
   * @param r Restaurante selecionado
   */
  onSelect(r: Restaurant) {
    if (this.cartItemCount > 0 && this.cartRestaurantId !== r._id) {
      return;
    }

    this.select.emit(r);

    setTimeout(() => {
      const nextSection = document.getElementById('after-restaurant-select');
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

  /**
   * Emite evento ao mudar rádio de tipo pickup/delivery
   */
  onTypeRadioChange(): void {
    const t = this.form.value.type as 'pickup' | 'delivery';
    this.typeChange.emit(t);
  }

  /**
   * Abre modal de detalhes para um restaurante
   * @param r Restaurante cujo modal será aberto
   */
  openRestaurantModal(r: Restaurant) {
    this.selectedModalRestaurant = r;
  }

  /**
   * Fecha o modal de detalhes de restaurante
   */
  closeRestaurantModal() {
    this.selectedModalRestaurant = null;
  }

   /**
   * Carrega todos os restaurantes ativos (vazia localização), aplica filtros iniciais
   */
  private loadAllRestaurants() {
    this.loading = true;
    this.error = null;
    this.rs.getActive().subscribe({
      next: (list) => {
        this.pickupList = list;
        this.unfilteredList = list;
        this.availableCategories = this.fullCategories;
        this.selectedCategory = '';
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.error = 'Erro ao carregar restaurantes.';
        this.loading = false;
      },
    });
  }
}
