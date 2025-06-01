/**
 * @component OrdersHistoryComponent
 * @description Componente standalone que apresenta o histórico de encomendas do cliente,
 * permitindo visualizar detalhes, expandir/collapse e submeter comentários por encomenda.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService, Order } from '../../services/orders/order.service';
import { CommentFormComponent } from '../comment-form/comment-form.component';
@Component({
  selector: 'app-orders-history',
  standalone: true,
  imports: [CommonModule, CommentFormComponent],
  templateUrl: './orders-history.component.html',
})
export class OrdersHistoryComponent implements OnInit {
  /** Lista de encomendas obtidas do serviço */
  orders: Order[] = [];
  /** ID da encomenda para a qual o utilizador está a submeter um comentário */
  commentingForOrderId: string | null = null;
  /** Conjunto de IDs de encomendas atualmente expandidas para mostrar detalhes */
  expandedOrders = new Set<string>();

  /**
   * @constructor
   * @param orderService Serviço para obter histórico de encomendas e métodos relacionados
   */
  constructor(private orderService: OrderService) {}

  /**
   * Lifecycle hook: carregamento inicial do histórico de encomendas
   */
  ngOnInit() {
    this.orderService.getHistory().subscribe((list) => {
      this.orders = list;
    });
  }

  /**
   * Abre o formulário de comentário para a encomenda especificada
   * @param restaurantId ID do restaurante associado à encomenda em comentário
   */
  openCommentForm(restaurantId: string) {
    this.commentingForOrderId = restaurantId;
  }

  /**
   * Handler chamado quando o comentário é submetido com sucesso
   * Fecha o formulário e notifica o utilizador
   */
  onCommentSubmitted() {
    this.commentingForOrderId = null;
    alert('Comentário enviado com sucesso!');
  }

  /**
   * Alterna estado expandido/colapsado dos detalhes da encomenda
   * @param o Objeto Order a expandir ou colapsar
   */
  toggleDetails(o: Order) {
    if (this.expandedOrders.has(o.id)) {
      this.expandedOrders.delete(o.id);
    } else {
      this.expandedOrders.add(o.id);
    }
  }

  /**
   * Verifica se os detalhes de uma encomenda estão visíveis (expandidos)
   * @param o Objeto Order a verificar
   * @returns true se estiver expandido, false caso contrário
   */
  showOrder(o: Order): boolean {
    return this.expandedOrders.has(o.id);
  }
}
