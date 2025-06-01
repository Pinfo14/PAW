/**
 * @component CheckoutComponent
 * @description Componente standalone que gere a página de checkout:
 *  - Inicializa dados do restaurante, cliente e itens do carrinho
 *  - Gera prompt para IA descrever o pedido
 *  - Obtém opinião da IA via API externa Groq/OpenAI
 *  - Envia encomenda ao criar e trata estados de loading/erro
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  CartService,
  CartItem,
  RestaurantSnapshot,
  CustomerSnapshot,
} from '../../services/cart/cart.service';
import { OrderService } from '../../services/orders/order.service';
import { HttpClient, HttpHeaders, HttpBackend } from '@angular/common/http';
import { AuthRestService } from '../../services/auth/auth-rest-service.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export class CheckoutComponent implements OnInit {
  /** Dados do restaurante para o pedido */
  restaurant!: RestaurantSnapshot;
  /** Dados do cliente (inclui morada e coordenadas) */
  customer!: CustomerSnapshot;
  /** HttpClient sem interceptor de auth para chamadas à API externa */
  httpNoAuth!: HttpClient;

  /** Itens do carrinho a encomendar */
  items: CartItem[] = [];
  /** Valor total do pedido */
  total = 0;
  /** Tipo de encomenda ('pickup' ou 'delivery') */
  orderType!: 'pickup' | 'delivery';
  /** Prompt gerado para a IA descrever o pedido */
  generatedPrompt = '';

  /** Resposta da IA com opinião sobre o pedido */
  aiOpinion = '';
  /** Flags de loading para cada operação */
  loadingOpinion = false;
  loadingOrder = false;
  loading = false;

  /** URL e chave de API da Groq/OpenAI para chat completions */
  private groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private groqKey =
    'Bearer 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';
  private model = 'meta-llama/llama-4-maverick-17b-128e-instruct';

   /**
   * @constructor
   * @param router Para navegação programática
   * @param cartService Serviço de gestão do carrinho
   * @param orderService Serviço de encomendas para criar pedido
   * @param http HttpClient com interceptors para chamadas internas
   * @param httpBackend Handler para criar HttpClient sem interceptores
   */
  constructor(
    public router: Router,
    private cartService: CartService,
    private orderService: OrderService,
    private http: HttpClient,
    private authService: AuthRestService,
    private httpBackend: HttpBackend
  ) {
    // Cria HttpClient sem autenticação para chamadas externas
    this.httpNoAuth = new HttpClient(httpBackend);

    // Obtém dados passados via state do Router
    const state = history.state as {
      restaurant?: RestaurantSnapshot;
      items?: CartItem[];
      total?: number;
      orderType?: 'pickup' | 'delivery';
    };

    // Se faltar algum dado, redireciona para home
    if (
      !state.restaurant ||
      !state.items ||
      state.total == null ||
      !state.orderType
    ) {
      this.router.navigate(['/']);
      return;
    }

     // Garante que existe cliente autenticado
     const customer = this.authService.getStoredUser();
     if (!customer) {
       this.router.navigate(['/']);
       return;
     }
     this.customer = customer as CustomerSnapshot;

    // Inicializa propriedades com dados do state e carrinho
    this.customer = customer;
    this.restaurant = state.restaurant;
    this.items = state.items;
    this.total = state.total;
    this.orderType = state.orderType;
    this.generatedPrompt = this.generatePrompt();
  }

  /**
   * Lifecycle hook: ao iniciar componente, gera opinião da IA
   */
  ngOnInit() {
    this.generateOpinion();
  }

  /**
   * Gera prompt e envia à API externa para obter descrição/opinião da IA
   */
  private generateOpinion(): void {
    this.loadingOpinion = true;
    this.generatedPrompt = this.generatePrompt();

    const headers = new HttpHeaders({
      Authorization: this.groqKey,
      'Content-Type': 'application/json',
    });

    this.httpNoAuth
      .post<any>(
        this.groqUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'És bastante snob e gostas de dar a tua opinião sobre a informação nutricional do que lês. Não excedas 300 palavras',
            },
            { role: 'user', content: this.generatedPrompt },
          ],
          max_tokens: 300,
          temperature: 1.2,
        },
        { headers }
      )
      .subscribe({
        next: (res) => {
          this.aiOpinion = res.choices?.[0]?.message?.content?.trim() ?? '';
          this.loadingOpinion = false;
        },
        error: (err) => {
          console.error('Erro ao gerar opinião:', err);
          this.aiOpinion = '❌ Não foi possível gerar a opinião.';
          this.loadingOpinion = false;
        },
      });
  }

  /**
   * Constrói prompt com lista de refeições, quantidades, tamanhos e preços
   * @returns Prompt formatado para envio à IA
   */
  private generatePrompt(): string {
    let prompt = `Gera uma descrição simpática e resumida do seguinte pedido:\n`;
    this.items.forEach((item) => {
      const price = item.selectedSize.price;
      const dose =
        item.selectedSize.name === 'full' ? 'dose completa' : 'meia dose';
      prompt += `- ${item.quantity}× ${
        item.meal.name
      } (${dose}, ${price.toFixed(2)}€)\n`;
    });
    return prompt;
  }

  /**
   * Confirma e submete encomenda ao backend:
   * - Prepara payload com refeições selecionadas
   * - Chama serviço para criar encomenda e trata sucesso/erro
   */
  confirmOrder(): void {
    if (this.loading) return;
    this.loading = true;

    const mealsPayload = this.items.map((item) => ({
      _id: item.meal._id,
      name: item.meal.name,
      description: item.meal.description,
      sizes: [
        {
          name: item.selectedSize.name,
          price: item.selectedSize.price,
        },
      ],
    }));
    console.log(this.cartService.getCustomerSnapshot())
    const payload = {
      type: this.orderType,
      customer: this.authService.getStoredUser(),
      restaurant: this.restaurant,
      restaurantId: this.restaurant.id,
      meals: mealsPayload,
    };

    this.orderService.createOrder(payload).subscribe({
      next: (_order) => {
        this.cartService.clear();
        this.router.navigate(['/meus-pedidos']);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 403 && err.error) {
          const until = new Date(err.error.until).toLocaleDateString();
          alert(
            `${err.error.error}\nMotivo: ${err.error.reason}\nAté: ${until}`
          );
        } else {
          alert('Erro ao criar encomenda. Tente novamente.');
        }
      },
    });
  }

    /**
   * Cancela checkout atual, limpa carrinho e redireciona para painel inicial
   */
  cancelOrder() {
    if (confirm('Cancelar encomenda? O teu carrinho será esvaziado.')) {
      this.cartService.clear();
      this.router.navigate(['/dashboard']);
    }
  }
}
