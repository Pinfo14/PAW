/**
 * @component CommentsListComponent
 * @description Componente standalone para listar comentários de um restaurante.
 * Busca comentários via CommentsService e permite fechar a lista.
 */
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommentsService } from '../../services/comments/comments.service';

/**
 * Interface que representa um comentário retornado pela API.
 */
export interface Comment {
  /** Identificador único do comentário */
  _id: string;
  /** Dados do cliente */
  clientId: { name: string };
  /** Texto do comentário */
  text: string;
  /** Data de criação em formato ISO */
  createdAt: string;
  /** Array de imagens associadas ao comentário */
  images: { imagePath: string }[]; // ← novo
}

@Component({
  selector: 'app-comments-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comment-list.component.html',
  styleUrls: ['./comment-list.component.css'],
})

export class CommentsListComponent implements OnInit, OnChanges {
  /**
   * ID do restaurante cujos comentários serão exibidos
   */
  @Input() restaurantId!: string;
  /**
   * Emite evento para fechar a lista de comentários
   */
  @Output() close = new EventEmitter<void>();

  /** Array de comentários carregados */
  comments: Comment[] = [];
  /** Flag de loading durante a carga de comentários */
  loading = false;
  /** Mensagem de erro em caso de falha na carga */
  error: string | null = null;

  /**
   * @constructor
   * @param commentService Serviço para buscar lista de comentários
   */
  constructor(private commentService: CommentsService) {}

  /**
   * Lifecycle hook: executa fetchComments quando o componente é inicializado
   */
  ngOnInit() {
    this.fetchComments();
  }

  /**
   * Procura comentários para o restaurantId atual
   */
  fetchComments() {
    this.loading = true;
    this.error = null;
    this.commentService.listByRestaurant(this.restaurantId).subscribe({
      next: (list) => {
        this.comments = list;
        this.loading = false;
      },
      error: () => {
        this.error = 'Não foi possível carregar comentários.';
        this.loading = false;
      },
    });
  }

   /**
   * Lifecycle hook: detecta mudanças em restaurantId e refaz fetch se necessário
   * @param changes Objeto com mudanças nos inputs
   */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['restaurantId'] && !changes['restaurantId'].firstChange) {
      this.fetchComments();
    }
  }

    /**
   * Emite evento para fechar a lista de comentários
   */
  onClose() {
    this.close.emit();
  }
}
