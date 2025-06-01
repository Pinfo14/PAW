/**
 * @component CategoryFilterComponent
 * @description Componente standalone para filtrar restaurantes por categoria.
 * Recebe lista de categorias e emite evento quando a seleção de categoria muda.
 */
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-category-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './restaurant-filters.component.html',
})

/**
 * Representa uma categoria de restaurante
 */
export class CategoryFilterComponent {
/**
   * Lista de categorias disponíveis para filtragem
   */
  @Input() categories: { _id: string; name: string }[] = [];
  /**
   * Evento emitido quando a categoria selecionada muda
   * @output Emits o ID da categoria selecionada
   */
  @Output() categoryChange = new EventEmitter<string>();

  /**
   * Lida com mudança de seleção de categoria
   * @param catId ID da categoria selecionada
   */
  onChange(catId: string) {
    this.categoryChange.emit(catId);
  }
}
