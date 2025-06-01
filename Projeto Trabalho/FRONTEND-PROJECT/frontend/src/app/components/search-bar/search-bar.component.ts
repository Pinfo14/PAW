/**
 * @component SearchBarComponent
 * @description Componente standalone que disponibiliza uma barra de pesquisa
 * com debounce de 300ms e emite o termo pesquisado em lowercase trimmed.
 */
import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <input
      type="text"
      [formControl]="control"
      class="form-control mb-3"
      placeholder="Pesquisar restaurantes..."
    />
  `,
})
export class SearchBarComponent {
  /**
   * Evento emitido sempre que o termo de pesquisa é atualizado
   * @output Emite string do termo pesquisado (trimmed e lowercase)
   */
  @Output() search = new EventEmitter<string>();
  /**
   * FormControl associado ao input de pesquisa
   */
  control = new FormControl('');

  /**
   * @constructor
   * Inicializa o FormControl e subscreve mudanças de valor para emitir search com debounce
   */
  constructor() {
    this.control.valueChanges
      .pipe(debounceTime(300))
      .subscribe((term) => this.search.emit(term?.trim().toLowerCase() || ''));
  }
}
