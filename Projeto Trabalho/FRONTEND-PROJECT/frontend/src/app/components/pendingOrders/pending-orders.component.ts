/**
 * @component PendingOrdersComponent
 * @description Componente standalone que exibe e gere as encomendas pendentes do cliente,
 * incluindo contagem decrescente para pick-up e possibilidade de cancelamento.
 */
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  CreatedOrder,
  OrderService
} from '../../services/orders/order.service';
import { Router } from '@angular/router';
import { ImageService } from '../../services/image/image.service';
import { AuthRestService } from '../../services/auth/auth-rest-service.service';

@Component({
  selector: 'app-pending-orders',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './pending-orders.component.html',
  providers: [ImageService],
})
export class PendingOrdersComponent implements OnInit, OnDestroy {
  /** Encomenda atualmente pendente, ou null se não existir */
  order: CreatedOrder | null = null;
  /** Código de pick-up gerado a partir do ID da encomenda */
  pickupCode = '';
  /** Milissegundos restantes até expirar o prazo de pick-up */
  remainingMs = 0;
  /** ID do intervalo de contagem decrescente para limpeza posterior */
  private intervalId?: number;

  /**
   * @constructor
   * @param orderService Serviço para obter encomenda pendente e ações relacionadas
   * @param authService Serviço de autenticação para logout
   * @param router Router do Angular para navegação
   * @param imageService Serviço para resolução de URLs de imagens
   */
  constructor(
    public orderService: OrderService,
    private authService: AuthRestService,
    private router: Router,
    public imageService: ImageService
  ) {}

  /**
   * Lifecycle hook: subscreve ao pedido pendente e inicia contagem decrescente se necessário
   */
  ngOnInit() {
    this.orderService.pending$.subscribe((o) => {
      this.clearCountdown();

      this.order = o;
      if (o) {
        // Gera código de pick-up a partir dos últimos 4 dígitos do ID
        this.pickupCode = o._id.slice(-4);
      }
      if (o && o.currentStatus === 'Ordered') {
        const created = new Date(o.createdAt).getTime();
        const deadline = created + 5 * 60 * 1000; // 5 minutos após criação
        this.remainingMs = Math.max(0, deadline - Date.now());

        if (this.remainingMs > 0) {
          this.startCountdown(deadline);
        }
      } else {
        // Se não estiver em estado 'Ordered', zera contagem
        this.remainingMs = 0;
      }
    });
  }

  /**
   * Lifecycle hook: limpa o intervalo de contagem ao destruir componente
   */
  ngOnDestroy() {
    this.clearCountdown();
  }

  /**
   * Inicia o intervalo de contagem decrescente até o prazo de pick-up
   * @param deadline Timestamp em milissegundos do prazo final
   */
  private startCountdown(deadline: number) {
    this.intervalId = window.setInterval(() => {
      const now = Date.now();
      this.remainingMs = Math.max(0, deadline - now);

      if (this.remainingMs === 0) {
        this.clearCountdown();
      }
    }, 1000);
  }

  /**
   * Limpa o intervalo de contagem decrescente, se existir
   */
  private clearCountdown() {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Tenta cancelar a encomenda se ainda estiver dentro do prazo e estado for 'Ordered'
   */
  onCancel() {
    if (!this.order) return;
    if (this.remainingMs > 0 && this.order.currentStatus === 'Ordered') {
      this.orderService.cancelOrder(this.order._id).subscribe(() => {
        this.order = null;
        this.remainingMs = 0;
        this.clearCountdown();
      });
    }
  }

/**
   * Getter: formata o tempo restante em MM:SS para exibição
   * @returns String formatada representando minutos e segundos restantes
   */
  get formattedRemaining(): string {
    const totalSec = Math.floor(this.remainingMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const mm = String(min).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  /**
   * Efetua logout do utilizador, limpa encomenda pendente e redireciona para página inicial
   */
  onLogout(): void {
    this.authService.logout();
    this.orderService.clearPending();
    this.router.navigate(['/']);
  }
}
