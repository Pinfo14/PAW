/**
 * @component LoginComponent
 * @description Componente standalone para gerir autenticação de utilizador.
 *  - Apresenta campos de email e password
 *  - Chama AuthRestService.login e trata respostas
 *  - Redireciona após login bem-sucedido e valida carrinho existente
 */
import { Component } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../services/orders/order.service';
import { CartService } from '../../services/cart/cart.service';
import { LocationService } from '../../services/location/location.service';
import { RestaurantsService } from '../../services/restaurants/restaurants.service';
import { take } from 'rxjs/operators';
import { AuthRestService } from '../../services/auth/auth-rest-service.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  /** Email inserido pelo utilizador */
  email = '';
  /** Password inserida pelo utilizador */
  password = '';
  /** Mensagem de erro a exibir em caso de falha no login */
  error: string | null = null;
  /** URL de retorno após login bem-sucedido */
  returnUrl: string = '/';

   /**
   * @constructor
   * @param authService Serviço de autenticação para chamadas de login
   * @param orderService Serviço para inicializar encomendas pendentes
   * @param cartService Serviço para validação e limpeza de carrinho
   * @param locationService Serviço para obter localização do cliente
   * @param restaurantsService Serviço para buscar restaurantes ativos ou por localização
   * @param router Router do Angular para navegação
   * @param activatedRoute Para ler parâmetros de consulta (returnUrl)
   */
  constructor(
    private authService: AuthRestService,
    private orderService: OrderService,
    private cartService: CartService,
    private locationService: LocationService,
    private restaurantsService: RestaurantsService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    // Lê parâmetro returnUrl da rota, se existir
    const param = this.activatedRoute.snapshot.queryParams['returnUrl'];
    if (param) {
      this.returnUrl = param;
    }
  }

  /**
   * Handler de submissão do formulário de login.
   * Chama o serviço de autenticação e, em caso de sucesso,
   * inicializa estado de encomendas e valida o carrinho.
   */
  onSubmit(): void {
    this.error = null;
    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        // Guarda token, inicializa encomendas e valida carrinho
        this.authService.setToken(res.token);
        this.orderService.initPending();
        this.validateCartAfterLogin();
      },
      error: (err) => {
        console.error('Erro no login:', err);
        this.error = err.error?.error || 'Falha no login';
      },
    });
  }

  /**
   * Valida o conteúdo do carrinho após login:
   *  - Se carrinho vazio ou restaurante não definido, finaliza login
   *  - Caso contrário, verifica disponibilidade do restaurante
   *    via localização ou lista de restaurantes ativos
   */
  private validateCartAfterLogin(): void {
    this.cartService.items$.pipe(take(1)).subscribe((items) => {
      // Se não existem itens, finaliza login diretamente
      if (items.length === 0) {
        return this.finalizeLogin();
      }

      const snap = this.cartService.getRestaurantSnapshot();
      if (!snap) {
        return this.finalizeLogin();
      }

      const orderType = this.cartService.getOrderType()!;
        // Se restaurante do carrinho não estiver na lista permitida,
        // limpa carrinho e notifica o utilizador
        const checkAndMaybeClear = (allowedIds: string[]) => {
        if (!allowedIds.includes(snap.id)) {
          this.cartService.logoutCleanup();
          alert(
            'O restaurante do seu carrinho já não está disponível. Carrinho limpo.'
          );
        }
        this.finalizeLogin();
      };

      // Se localização disponível, busca restaurantes por proximidade
      if (this.locationService.hasLocation()) {
        const { lat, lon } = this.locationService.getLocation();
        this.restaurantsService
          .getByLocation(lat, lon, orderType)
          .pipe(take(1))
          .subscribe(
            (list) => {
              const ids = list.map((r) => r._id);
              checkAndMaybeClear(ids);
            },
            () => {
              this.finalizeLogin();
            }
          );
        // Caso contrário, busca restaurantes ativos
      } else {
        this.restaurantsService
          .getActive()
          .pipe(take(1))
          .subscribe(
            (list) => {
              const ids = list.map((r) => r._id);
              checkAndMaybeClear(ids);
            },
            () => {
              this.finalizeLogin();
            }
          );
      }
    });
  }

  /**
   * Navega para a URL de retorno após validações concluídas
   */
  private finalizeLogin(): void {
    this.router.navigateByUrl(this.returnUrl);
  }
}
